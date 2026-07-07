import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBaseCurrencySeeded, FX_BASE_CURRENCY } from "@/lib/currency";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/exchange-rates — list all currencies (USD is auto-seeded as the
// fixed base if it doesn't exist yet). Available to any logged-in user, for
// the "Send in" currency picker on a quote.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBaseCurrencySeeded();
  const rates = await prisma.exchangeRate.findMany({ orderBy: [{ isBase: "desc" }, { currency: "asc" }] });
  return NextResponse.json(
    rates.map((r) => ({
      currency: r.currency,
      symbol: r.symbol,
      name: r.name,
      rateFromBase: Number(r.rateFromBase),
      isBase: r.isBase,
      updatedAt: r.updatedAt,
    })),
  );
}

interface UpsertBody {
  currency: string;
  symbol: string;
  name: string;
  rateFromBase: number;
}

// POST /api/exchange-rates — create or update a currency. Admin only. USD
// (the base) is pinned at rate 1 and can't be changed via this route.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user.roles)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const currency = body.currency?.trim().toUpperCase();
  const symbol = body.symbol?.trim() || currency;
  const name = body.name?.trim();
  const rateFromBase = Number(body.rateFromBase);

  if (!currency || !name || !Number.isFinite(rateFromBase) || rateFromBase <= 0) {
    return NextResponse.json(
      { error: "Currency code, name, and a positive rate are required." },
      { status: 400 },
    );
  }

  if (currency === FX_BASE_CURRENCY) {
    return NextResponse.json(
      { error: "USD is the fixed base currency (rate 1) and can't be edited." },
      { status: 400 },
    );
  }

  const saved = await prisma.exchangeRate.upsert({
    where: { currency },
    update: { symbol, name, rateFromBase },
    create: { currency, symbol, name, rateFromBase, isBase: false },
  });
  return NextResponse.json(saved, { status: 201 });
}
