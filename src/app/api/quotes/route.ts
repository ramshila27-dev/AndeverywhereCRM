import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { MarkupInput, QuoteItem, QuoteTripInput } from "@/lib/types";
import { buildDayWiseItinerary, computeDestinationLabel } from "@/lib/itinerary";
import { applyMarkup } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A quote is visible to admins, its creator, and the employee who owns the
// originating query.
function quoteScope(user: {
  id: string;
  roles: import("@prisma/client").Role[];
}): Prisma.QuoteWhereInput {
  if (isAdmin(user.roles)) return {};
  return {
    OR: [{ createdById: user.id }, { query: { assignees: { some: { id: user.id } } } }],
  };
}

// GET /api/quotes?search=... — list saved quotes (scoped to the current user).
// `search` matches title or city, for the "import a previous quote" picker.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = new URL(req.url).searchParams.get("search")?.trim();
  const quotes = await prisma.quote.findMany({
    where: {
      ...quoteScope(user),
      ...(search
        ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(quotes);
}

interface CreateBody {
  trip: QuoteTripInput;
  items: QuoteItem[];
  markup?: MarkupInput;
  inclusions?: string[];
  exclusions?: string[];
  notes?: string;
}

// POST /api/quotes — persist a built quote. The server recomputes the totals
// from the submitted line items so the stored total is authoritative.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { trip, items } = body;
  if (!trip?.city || !trip.checkIn || !trip.checkOut) {
    return NextResponse.json(
      { error: "trip.city, checkIn and checkOut are required." },
      { status: 400 },
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "At least one line item is required." },
      { status: 400 },
    );
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const days = buildDayWiseItinerary(trip.checkIn, trip.checkOut, items);
  const markupType = body.markup?.type === "FIXED" ? "FIXED" : "PERCENT";
  const markupValue = Math.max(0, Number(body.markup?.value) || 0);
  const { total } = applyMarkup(subtotal, markupType, markupValue);

  const created = await prisma.quote.create({
    data: {
      title: trip.title || `${trip.city} quote`,
      city: computeDestinationLabel(items, trip.city),
      checkIn: new Date(trip.checkIn),
      checkOut: new Date(trip.checkOut),
      adults: Number(trip.adults) || 2,
      children: Number(trip.children) || 0,
      items: items as unknown as Prisma.InputJsonValue,
      days: days as unknown as Prisma.InputJsonValue,
      subtotal,
      markupType,
      markupValue,
      total,
      inclusions: Array.isArray(body.inclusions) ? body.inclusions.filter(Boolean) : [],
      exclusions: Array.isArray(body.exclusions) ? body.exclusions.filter(Boolean) : [],
      notes: body.notes || null,
      queryId: trip.queryId || null,
      createdById: user.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
