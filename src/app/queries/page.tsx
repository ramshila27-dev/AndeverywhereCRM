import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, QueryStatus } from "@prisma/client";
import {
  QUERY_STATUSES,
  QUERY_STATUS_STYLE,
  type QueryStatusValue,
} from "@/lib/types";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "No date";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function QueriesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requirePermission("queries");
  const admin = isAdmin(user.roles);
  const active = searchParams.status || "ALL";

  // Employees only see queries assigned to them; admins see everything.
  const scope: Prisma.QueryWhereInput = admin ? {} : { assignees: { some: { id: user.id } } };

  let counts: Record<string, number> = {};
  let queries: Prisma.QueryGetPayload<{
    include: { assignees: { select: { name: true } } };
  }>[] = [];
  let dbError = false;

  try {
    const grouped = await prisma.query.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    });
    counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    queries = await prisma.query.findMany({
      where: {
        ...scope,
        ...(active !== "ALL" ? { status: active as QueryStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { assignees: { select: { name: true } } },
    });
  } catch {
    dbError = true;
  }

  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0);

  const navItems: { value: string; label: string }[] = [
    ...QUERY_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    { value: "ALL", label: "All" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[190px_1fr]">
      {/* Lifecycle sidebar */}
      <aside>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Trips</h2>
        <nav className="space-y-0.5 text-sm">
          {navItems.map((item) => {
            const isActive = active === item.value;
            const count =
              item.value === "ALL" ? totalAll : counts[item.value] ?? 0;
            return (
              <Link
                key={item.value}
                href={
                  item.value === "ALL"
                    ? "/queries"
                    : `/queries?status=${item.value}`
                }
                className={`flex items-center justify-between rounded-md px-3 py-1.5 ${
                  isActive
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="text-xs text-slate-400">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Query list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {navItems.find((n) => n.value === active)?.label ?? "All"}
            </h1>
            <p className="text-sm text-slate-500">
              {admin
                ? "All queries across the team."
                : "Queries assigned to you."}
            </p>
          </div>
          <Link
            href="/queries/new"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + New Query
          </Link>
        </div>

        {dbError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Could not reach the database. Start it with{" "}
            <code className="rounded bg-amber-100 px-1">docker compose up -d</code>
            .
          </div>
        )}

        {!dbError && queries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-lg font-medium text-slate-700">No queries here</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a query to start the sales pipeline.
            </p>
            <Link
              href="/queries/new"
              className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              New Query
            </Link>
          </div>
        )}

        <div className="grid gap-3">
          {queries.map((q) => (
            <Link
              key={q.id}
              href={`/queries/${q.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {q.salutation ? `${q.salutation} ` : ""}
                    {q.guestName}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      QUERY_STATUS_STYLE[q.status as QueryStatusValue]
                    }`}
                  >
                    {
                      QUERY_STATUSES.find((s) => s.value === q.status)?.label ??
                      q.status
                    }
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {q.destinations.length
                    ? q.destinations.join(", ")
                    : "No destination"}{" "}
                  · {fmtDate(q.startDate)} · {q.nights}N · {q.adults}A
                  {q.childAges.length ? ` ${q.childAges.length}C` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                {q.source && <div>{q.source}</div>}
                <div className="font-medium text-slate-500">
                  {q.assignees.length ? q.assignees.map((a) => a.name).join(", ") : "Unassigned"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
