import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QuoteView from "@/components/QuoteView";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { QuoteItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePermission("quotes");
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { query: { select: { assignees: { select: { id: true } } } } },
  });
  if (!quote) notFound();
  // Employees can only open quotes they created or that belong to a query
  // assigned to them.
  if (
    !isAdmin(user.roles) &&
    quote.createdById !== user.id &&
    !quote.query?.assignees.some((a) => a.id === user.id)
  ) {
    redirect("/quotes");
  }

  return (
    <div className="space-y-4">
      <Link
        href="/quotes"
        className="inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to quotes
      </Link>

      <QuoteView
        id={quote.id}
        title={quote.title}
        city={quote.city}
        dateRange={`${fmtDate(quote.checkIn)} – ${fmtDate(quote.checkOut)}`}
        pax={`${quote.adults}A${quote.children ? ` ${quote.children}C` : ""}`}
        status={quote.status}
        currency={quote.currency}
        subtotal={Number(quote.subtotal)}
        markupType={quote.markupType as "PERCENT" | "FIXED"}
        markupValue={Number(quote.markupValue)}
        total={Number(quote.total)}
        items={(quote.items as unknown as QuoteItem[]) ?? []}
        isAdmin={isAdmin(user.roles)}
      />
    </div>
  );
}
