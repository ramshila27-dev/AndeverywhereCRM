import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QUOTE_STATUS_OPTIONS, type MarkupInput, type QuoteItem, type QuoteTripInput } from "@/lib/types";
import { buildDayWiseItinerary, computeDestinationLabel } from "@/lib/itinerary";
import { applyMarkup } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// GET /api/quotes/:id
export async function GET(_req: Request, { params }: Params) {
  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(quote);
}

interface PatchBody {
  status?: string;
  title?: string;
  notes?: string;
  // Full content update (edit mode in QuoteBuilder). Only accepted while the
  // quote is still a draft — once a quote has been sent, its content is
  // locked to keep what was actually sent to the client reproducible.
  trip?: QuoteTripInput;
  items?: QuoteItem[];
  markup?: MarkupInput;
  inclusions?: string[];
  exclusions?: string[];
}

// PATCH /api/quotes/:id
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !QUOTE_STATUS_OPTIONS.includes(
      body.status as (typeof QUOTE_STATUS_OPTIONS)[number],
    )
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const data: Prisma.QuoteUpdateInput = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.title !== undefined) data.title = body.title;
  if (body.notes !== undefined) data.notes = body.notes;

  // Full content edit — allowed at any point regardless of status. Status is
  // purely informational (draft/sent/confirmed) and no longer gates editing.
  if (body.items || body.trip) {
    const existing = await prisma.quote.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
    }
    if (!body.trip?.city || !body.trip.checkIn || !body.trip.checkOut) {
      return NextResponse.json({ error: "trip.city, checkIn and checkOut are required." }, { status: 400 });
    }

    const subtotal = body.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const days = buildDayWiseItinerary(body.trip.checkIn, body.trip.checkOut, body.items);
    const markupType = body.markup?.type === "FIXED" ? "FIXED" : "PERCENT";
    const markupValue = Math.max(0, Number(body.markup?.value) || 0);
    const { total } = applyMarkup(subtotal, markupType, markupValue);

    data.title = body.trip.title || data.title;
    data.city = computeDestinationLabel(body.items, body.trip.city);
    data.checkIn = new Date(body.trip.checkIn);
    data.checkOut = new Date(body.trip.checkOut);
    data.adults = Number(body.trip.adults) || 2;
    data.children = Number(body.trip.children) || 0;
    data.items = body.items as unknown as Prisma.InputJsonValue;
    data.days = days as unknown as Prisma.InputJsonValue;
    data.subtotal = subtotal;
    data.markupType = markupType;
    data.markupValue = markupValue;
    data.total = total;
    data.inclusions = Array.isArray(body.inclusions) ? body.inclusions.filter(Boolean) : [];
    data.exclusions = Array.isArray(body.exclusions) ? body.exclusions.filter(Boolean) : [];
  }

  try {
    const updated = await prisma.quote.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}

// DELETE /api/quotes/:id
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.quote.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
