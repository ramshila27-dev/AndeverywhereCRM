import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QuoteBuilder from "@/components/QuoteBuilder";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { QuoteItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const user = await requirePermission("quotes");
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { query: { select: { assignees: { select: { id: true } }, id: true } } },
  });
  if (!quote) notFound();

  if (
    !isAdmin(user.roles) &&
    quote.createdById !== user.id &&
    !quote.query?.assignees.some((a) => a.id === user.id)
  ) {
    redirect("/quotes");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/quotes/${quote.id}`} className="inline-block text-sm text-slate-500 hover:text-slate-700">
          ← Back to quote
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Edit Quote</h1>
        <p className="text-sm text-slate-500">Changes save back to this same quote.</p>
      </div>
      <QuoteBuilder
        initial={{
          quoteId: quote.id,
          queryId: quote.queryId ?? undefined,
          title: quote.title,
          city: quote.city,
          checkIn: quote.checkIn.toISOString().slice(0, 10),
          checkOut: quote.checkOut.toISOString().slice(0, 10),
          adults: quote.adults,
          children: quote.children,
          items: (quote.items as unknown as QuoteItem[]) ?? [],
          markup: { type: quote.markupType as "PERCENT" | "FIXED", value: Number(quote.markupValue) },
          inclusions: quote.inclusions,
          exclusions: quote.exclusions,
        }}
      />
    </div>
  );
}
