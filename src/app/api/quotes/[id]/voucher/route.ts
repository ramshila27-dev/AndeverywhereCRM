import { prisma } from "@/lib/prisma";
import { renderVoucherPdf } from "@/lib/pdf/VoucherDoc";
import type { QuoteItem } from "@/lib/types";

export const runtime = "nodejs";

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// GET /api/quotes/:id/voucher — operational service voucher, no pricing shown.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
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

  const guest = quote.query
    ? `${quote.query.salutation ? quote.query.salutation + " " : ""}${quote.query.guestName}`
    : undefined;
  const reference = `VC-${quote.id.slice(-6).toUpperCase()}`;

  const pdf = await renderVoucherPdf({
    reference,
    title: quote.title,
    city: quote.city,
    dateRange: `${fmt(quote.checkIn)} – ${fmt(quote.checkOut)}`,
    pax: `${quote.adults} Adult${quote.adults > 1 ? "s" : ""}${
      quote.children ? ` · ${quote.children} Child${quote.children > 1 ? "ren" : ""}` : ""
    }`,
    guestName: guest,
    salesTeam: quote.query?.salesTeam,
    dateStr: fmt(quote.createdAt),
    items: (quote.items as unknown as QuoteItem[]) ?? [],
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reference}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
