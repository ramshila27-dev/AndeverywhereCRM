import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QueryLifecycle from "@/components/QueryLifecycle";
import AssignQuery from "@/components/AssignQuery";
import { formatMoney } from "@/lib/pricing";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { Phone, QueryStatusValue } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function QueryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePermission("queries");
  const admin = isAdmin(user.roles);

  const query = await prisma.query.findUnique({
    where: { id: params.id },
    include: {
      assignees: { select: { id: true, name: true } },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, total: true, currency: true },
      },
    },
  });
  if (!query) notFound();
  // Employees can only open queries assigned to them.
  if (!admin && !query.assignees.some((a) => a.id === user.id)) redirect("/queries");

  // Admins get the roster to (re)assign the query owner.
  const employees = admin
    ? await prisma.user.findMany({
        where: { status: { not: "SUSPENDED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const phones = (query.phones as unknown as Phone[]) ?? [];

  // Prefill params for starting a quote from this query.
  const quoteParams = new URLSearchParams({
    queryId: query.id,
    adults: String(query.adults),
    children: String(query.childAges.length),
    nights: String(query.nights),
  });
  if (query.destinations[0]) quoteParams.set("destination", query.destinations[0]);
  if (query.startDate)
    quoteParams.set("checkIn", new Date(query.startDate).toISOString().slice(0, 10));
  if (query.guestName) quoteParams.set("title", `${query.guestName} — quote`);

  return (
    <div className="space-y-4">
      <Link
        href="/queries"
        className="inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to queries
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {query.salutation ? `${query.salutation} ` : ""}
            {query.guestName}
          </h1>
          <p className="text-sm text-slate-500">
            {query.destinations.length
              ? query.destinations.join(", ")
              : "No destination"}{" "}
            · {query.nights} Night{query.nights > 1 ? "s" : ""},{" "}
            {query.nights + 1} Days
          </p>
        </div>
        <div className="flex items-center gap-2">
          {admin && (
            <Link
              href={`/queries/${query.id}/edit`}
              className="rounded-md border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              ✎ Edit Query
            </Link>
          )}
          <Link
            href={`/quotes/new?${quoteParams.toString()}`}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Start a quote →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Query details</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Source" value={query.source} />
              <Field label="Reference ID" value={query.referenceId} />
              <Field
                label="Assigned to"
                value={query.assignees.length ? query.assignees.map((a) => a.name).join(", ") : "Unassigned"}
              />
              <Field label="Start Date" value={fmtDate(query.startDate)} />
              <Field
                label="Duration"
                value={`${query.nights}N / ${query.nights + 1}D`}
              />
              <Field
                label="Pax"
                value={`${query.adults} Adult${query.adults > 1 ? "s" : ""}${
                  query.childAges.length
                    ? ` · ${query.childAges.length} Child (ages ${query.childAges.join(", ")})`
                    : ""
                }${query.totalFoc ? ` · ${query.totalFoc} FOC` : ""}`}
              />
            </dl>
            {query.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {query.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Guest details</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="Phone(s)"
                value={
                  phones.length
                    ? phones.map((p) => `+${p.code.split("-")[0]} ${p.number}`).join(", ")
                    : "—"
                }
              />
              <Field label="Email" value={query.email} />
              <Field label="Location" value={query.location} />
            </dl>
          </div>

          {query.comments && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 font-semibold text-slate-900">Comments</h2>
              <p className="text-sm text-slate-600">{query.comments}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Quotes</h2>
              <Link
                href={`/quotes/new?${quoteParams.toString()}`}
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                + New quote
              </Link>
            </div>
            {query.quotes.length === 0 ? (
              <p className="text-sm text-slate-400">
                No quotes yet. Start one to price this enquiry from contracted
                rates.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {query.quotes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="flex items-center justify-between py-2 text-sm hover:text-brand-700"
                    >
                      <span>
                        {q.title}{" "}
                        <span className="text-xs capitalize text-slate-400">
                          · {q.status}
                        </span>
                      </span>
                      <span className="font-medium">
                        {formatMoney(Number(q.total), q.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <QueryLifecycle
            id={query.id}
            status={query.status as QueryStatusValue}
          />
          {admin && (
            <AssignQuery
              queryId={query.id}
              current={query.assignees.map((a) => a.id)}
              employees={employees}
            />
          )}
        </div>
      </div>
    </div>
  );
}
