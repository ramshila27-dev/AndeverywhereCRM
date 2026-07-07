import { prisma } from "@/lib/prisma";
import { renderQuotePdf } from "@/lib/pdf/QuoteDoc";
import { convertFromBase } from "@/lib/currency";
import { computePerPaxBreakdown } from "@/lib/pricing";
import { buildDayWiseItinerary } from "@/lib/itinerary";
import type { QuoteDayPlan, QuoteItem } from "@/lib/types";

export const runtime = "nodejs";

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// GET /api/quotes/:id/pdf?currency=USD — branded client-facing PDF quotation.
// If `currency` is omitted or has no exchange rate on file, falls back to
// the quote's net currency (HKD) rather than showing a wrong number.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { query: { select: { guestName: true, salutation: true, salesTeam: true } } },
  });
  if (!quote) {
    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const requestedCurrency = new URL(req.url).searchParams.get("currency") || undefined;
  const converted = await convertFromBase(Number(quote.total), quote.currency, requestedCurrency);

  const guest = quote.query
    ? `${quote.query.salutation ? quote.query.salutation + " " : ""}${quote.query.guestName}`
    : undefined;

  const reference = `QT-${quote.id.slice(-6).toUpperCase()}`;
  const items = (quote.items as unknown as QuoteItem[]) ?? [];

  // Older quotes saved before the day-wise snapshot existed (or one that's
  // empty for any other reason) get it computed fresh here instead of
  // silently omitting the section.
  const storedDays = (quote.days as unknown as QuoteDayPlan[]) ?? [];
  const days = storedDays.length > 0
    ? storedDays
    : buildDayWiseItinerary(quote.checkIn.toISOString().slice(0, 10), quote.checkOut.toISOString().slice(0, 10), items);

  const perPax = computePerPaxBreakdown(items, Number(quote.subtotal), Number(quote.total), quote.adults, quote.children);
  const perPaxConverted = {
    perAdult: (await convertFromBase(perPax.perAdult, quote.currency, requestedCurrency)).amount,
    perChild: perPax.perChild != null ? (await convertFromBase(perPax.perChild, quote.currency, requestedCurrency)).amount : null,
  };

  const pdf = await renderQuotePdf({
    reference,
    title: quote.title,
    city: quote.city,
    dateRange: `${fmt(quote.checkIn)} – ${fmt(quote.checkOut)}`,
    pax: `${quote.adults} Adult${quote.adults > 1 ? "s" : ""}${
      quote.children ? ` · ${quote.children} Child${quote.children > 1 ? "ren" : ""}` : ""
    }`,
    adults: quote.adults,
    children: quote.children,
    status: quote.status,
    currency: converted.currency,
    total: converted.amount,
    perAdultPrice: perPaxConverted.perAdult,
    perChildPrice: perPaxConverted.perChild,
    guestName: guest,
    salesTeam: quote.query?.salesTeam,
    dateStr: fmt(quote.createdAt),
    items,
    days,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reference}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
