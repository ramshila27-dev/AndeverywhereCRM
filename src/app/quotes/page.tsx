import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/pricing";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
};

export default async function QuotesPage() {
  const user = await requirePermission("quotes");
  const scope: Prisma.QuoteWhereInput = isAdmin(user.roles)
    ? {}
    : { OR: [{ createdById: user.id }, { query: { assignees: { some: { id: user.id } } } }] };

  let quotes: Awaited<ReturnType<typeof prisma.quote.findMany>> = [];
  let dbError = false;
  try {
    quotes = await prisma.quote.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500">
            Itemized prices built from contracted rates.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + New Quote
        </Link>
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Could not reach the database. Start it with{" "}
          <code className="rounded bg-amber-100 px-1">docker compose up -d</code>.
        </div>
      )}

      {!dbError && quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-slate-700">No quotes yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Build your first priced quote from the rate catalog.
          </p>
          <Link
            href="/quotes/new"
            className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Build a quote
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {quotes.map((q) => (
          <Link
            key={q.id}
            href={`/quotes/${q.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">{q.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    statusStyles[q.status] ?? statusStyles.draft
                  }`}
                >
                  {q.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {q.city} · {fmtDate(q.checkIn)} – {fmtDate(q.checkOut)} ·{" "}
                {q.adults}A{q.children ? ` ${q.children}C` : ""}
              </p>
            </div>
            <span className="font-semibold text-brand-700">
              {formatMoney(Number(q.total), q.currency)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
