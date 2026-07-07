import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FX_BASE_CURRENCY } from "@/lib/currency";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

// DELETE /api/exchange-rates/:currency — admin only. The base currency (USD)
// can't be deleted since every conversion pivots through it.
export async function DELETE(_req: Request, { params }: { params: { currency: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user.roles)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const currency = params.currency.toUpperCase();
  if (currency === FX_BASE_CURRENCY) {
    return NextResponse.json({ error: "The base currency (USD) can't be deleted." }, { status: 400 });
  }

  try {
    await prisma.exchangeRate.delete({ where: { currency } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
