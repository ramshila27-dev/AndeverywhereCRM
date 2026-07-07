import Link from "next/link";
import { getReport, getFilterOptions, type ReportFilters } from "@/lib/reports";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "trips", label: "Trips" },
  { key: "team", label: "Sales Team" },
  { key: "destinations", label: "Destinations" },
  { key: "sources", label: "Trip Sources" },
];

function amt(n: number, currency = "HKD"): string {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}
function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}
function n0(n: number): string {
  return n.toLocaleString();
}

function Kpi({
  label,
  value,
  prefix,
  accent,
}: {
  label: string;
  value: string;
  prefix?: string;
  accent?: boolean;
}) {
  return (
    <div className={`flex-1 ${accent ? "border-l-4 border-accent-500 pl-4" : "pl-4"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">
        {prefix && <span className="mr-1 text-sm font-medium text-slate-400">{prefix}</span>}
        {value}
      </div>
    </div>
  );
}

interface SearchParams {
  month?: string;
  tab?: string;
  destination?: string;
  source?: string;
  salesTeam?: string;
  createdFrom?: string;
  createdTo?: string;
  startFrom?: string;
  startTo?: string;
  endFrom?: string;
  endTo?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("reports");
  const tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as string) : "trips";

  const filters: ReportFilters = {
    destination: searchParams.destination || undefined,
    source: searchParams.source || undefined,
    salesTeam: searchParams.salesTeam || undefined,
    createdFrom: searchParams.createdFrom || undefined,
    createdTo: searchParams.createdTo || undefined,
    startFrom: searchParams.startFrom || undefined,
    startTo: searchParams.startTo || undefined,
    endFrom: searchParams.endFrom || undefined,
    endTo: searchParams.endTo || undefined,
  };
  const hasActiveFilters = Object.values(filters).some(Boolean);

  let data: Awaited<ReturnType<typeof getReport>> | null = null;
  let filterOptions: Awaited<ReturnType<typeof getFilterOptions>> = { destinations: [], sources: [], salesTeam: [] };
  let dbError = false;
  try {
    [data, filterOptions] = await Promise.all([
      getReport(searchParams.month, filters),
      getFilterOptions(),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError || !data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Could not reach the database. Start it with{" "}
        <code className="rounded bg-amber-100 px-1">docker compose up -d</code>.
      </div>
    );
  }

  // Preserves the currently-active filters (and month) when switching tabs
  // or paging months, so applied filters don't reset on navigation.
  const href = (t: string, month = data.monthKey) => {
    const params = new URLSearchParams({ month, tab: t });
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "month" || k === "tab") continue;
      if (v) params.set(k, v);
    }
    return `/reports?${params.toString()}`;
  };
  const cur = data.currency;

  const tripsHrefForSalesTeam = (name: string) => {
    const params = new URLSearchParams({ tab: "trips", month: data.monthKey, salesTeam: name });
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "month" || k === "tab" || k === "salesTeam") continue;
      if (v) params.set(k, v);
    }
    return `/reports?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      {/* Header + month nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Sales Report</h1>
        <div className="flex items-center gap-1">
          <Link
            href={href(tab, data.prevKey)}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            ‹
          </Link>
          <span className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
            {data.monthLabel}
          </span>
          <Link
            href={href(tab, data.nextKey)}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            ›
          </Link>
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900">{data.monthLabel}</h2>

      {/* KPIs */}
      <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-5">
        <Kpi label="Revenue" prefix={cur} value={n0(Math.round(data.kpis.revenue))} accent />
        <Kpi label="Leads" value={n0(data.kpis.leads)} />
        <Kpi label="Quotes" value={n0(data.kpis.quotes)} />
        <Kpi label="Conversion" value={n0(data.kpis.conversions)} />
      </div>

      {/* Main content (left) + vertical filter sidebar (right) */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5 lg:order-1">
          {/* Tab pills */}
          <nav className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 text-sm">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={href(t.key)}
                className={`rounded-lg px-3 py-1.5 ${
                  tab === t.key
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {tab === "trips"
                  ? `${data.trips.length} trip(s)`
                  : tab === "team"
                    ? `${data.team.length} sales person(s)`
                    : tab === "destinations"
                      ? `${data.destinations.length} destination(s)`
                      : `${data.sources.length} source(s)`}
              </p>
              <a
                href={`/api/reports/export?month=${data.monthKey}&tab=${tab}`}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                ⤓ Download Report
              </a>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {tab === "trips" && <TripsTable rows={data.trips} cur={cur} />}
              {tab === "team" && <TeamTable rows={data.team} cur={cur} tripsHref={tripsHrefForSalesTeam} />}
              {tab === "destinations" && <GroupTable rows={data.destinations} cur={cur} label="Destination" />}
              {tab === "sources" && <GroupTable rows={data.sources} cur={cur} label="Trip Source" />}
            </div>

            <p className="text-xs text-slate-400">
              Revenue counts quotes marked <em>sent</em> or <em>confirmed</em>.
              Conversions are leads that reached Converted / On Trip / Past Trips.
              Amounts in {cur}. Profit tracking requires sell price / markup — coming later.
            </p>
          </div>
        </div>

        {/* Vertical filter sidebar (right) */}
        <aside className="lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <form method="GET" action="/reports" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="month" value={data.monthKey} />

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Destination</label>
              <select name="destination" defaultValue={filters.destination ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">All</option>
                {filterOptions.destinations.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Trip Source</label>
              <select name="source" defaultValue={filters.source ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">All</option>
                {filterOptions.sources.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sales Team</label>
              <select name="salesTeam" defaultValue={filters.salesTeam ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">All</option>
                {filterOptions.salesTeam.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Created Between</label>
              <div className="space-y-2">
                <input type="date" name="createdFrom" defaultValue={filters.createdFrom ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input type="date" name="createdTo" defaultValue={filters.createdTo ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Start Date Between</label>
              <div className="space-y-2">
                <input type="date" name="startFrom" defaultValue={filters.startFrom ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input type="date" name="startTo" defaultValue={filters.startTo ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End Date Between</label>
              <div className="space-y-2">
                <input type="date" name="endFrom" defaultValue={filters.endFrom ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                <input type="date" name="endTo" defaultValue={filters.endTo ?? ""} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button type="submit" className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Apply Filters
              </button>
              <Link
                href={`/reports?tab=${tab}&month=${data.monthKey}`}
                className="block w-full rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset Filters
              </Link>
              {hasActiveFilters && (
                <p className="text-xs text-slate-400">Filters are currently applied.</p>
              )}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

// ------- tables -------

const th = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const thR = "px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500";
const td = "px-4 py-3 text-sm text-slate-700";
const tdR = "px-4 py-3 text-sm text-right text-slate-700";

function Empty({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-10 text-center text-sm text-slate-400">
        No data for this month.
      </td>
    </tr>
  );
}

function TripsTable({
  rows,
  cur,
}: {
  rows: Awaited<ReturnType<typeof getReport>>["trips"];
  cur: string;
}) {
  return (
    <table className="w-full min-w-[720px]">
      <thead className="border-b border-slate-100 bg-slate-50">
        <tr>
          <th className={th}>Ref</th>
          <th className={th}>Guest</th>
          <th className={th}>Basic Details</th>
          <th className={th}>Sales Person</th>
          <th className={th}>Date</th>
          <th className={thR}>Amount</th>
          <th className={thR}>Profit</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && <Empty span={7} />}
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className={td}>
              <Link href={`/quotes/${r.id}`} className="font-medium text-brand-700 hover:underline">
                {r.ref}
              </Link>
            </td>
            <td className={td}>{r.guest}</td>
            <td className={`${td} text-slate-500`}>{r.basic}</td>
            <td className={td}>{r.salesPerson}</td>
            <td className={td}>{r.date}</td>
            <td className={`${tdR} font-medium`}>{`${cur} ${Math.round(r.amount).toLocaleString()}`}</td>
            <td className={`${tdR} text-slate-300`}>—</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamTable({
  rows,
  cur,
  tripsHref,
}: {
  rows: Awaited<ReturnType<typeof getReport>>["team"];
  cur: string;
  tripsHref: (name: string) => string;
}) {
  return (
    <table className="w-full min-w-[760px]">
      <thead className="border-b border-slate-100 bg-slate-50">
        <tr>
          <th className={th}>Name</th>
          <th className={thR}>Leads</th>
          <th className={thR}>Quotes</th>
          <th className={thR}>Conversions</th>
          <th className={thR}>Conv %</th>
          <th className={thR}>Drops</th>
          <th className={thR}>Pax</th>
          <th className={thR}>Revenue</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && <Empty span={8} />}
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-slate-50">
            <td className={`${td} font-medium text-slate-800`}>{r.name}</td>
            <td className={tdR}>
              <Link href={tripsHref(r.name)} className="text-brand-700 hover:underline" title={`View trips assigned to ${r.name}`}>
                {n0(r.leads)}
              </Link>
            </td>
            <td className={tdR}>{n0(r.quotes)}</td>
            <td className={tdR}>{n0(r.conversions)}</td>
            <td className={tdR}>{pct(r.convPct)}</td>
            <td className={tdR}>{n0(r.drops)}</td>
            <td className={tdR}>{n0(r.pax)}</td>
            <td className={`${tdR} font-medium`}>
              {r.revenue ? `${cur} ${Math.round(r.revenue).toLocaleString()}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupTable({
  rows,
  cur,
  label,
}: {
  rows: Awaited<ReturnType<typeof getReport>>["destinations"];
  cur: string;
  label: string;
}) {
  return (
    <table className="w-full min-w-[720px]">
      <thead className="border-b border-slate-100 bg-slate-50">
        <tr>
          <th className={th}>{label}</th>
          <th className={thR}>Leads</th>
          <th className={thR}>Quotes</th>
          <th className={thR}>Conversions</th>
          <th className={thR}>Conv %</th>
          <th className={thR}>Pax</th>
          <th className={thR}>Revenue</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && <Empty span={7} />}
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-slate-50">
            <td className={`${td} font-medium text-slate-800`}>{r.name}</td>
            <td className={tdR}>{n0(r.leads)}</td>
            <td className={tdR}>{n0(r.quotes)}</td>
            <td className={tdR}>{n0(r.conversions)}</td>
            <td className={tdR}>{pct(r.convPct)}</td>
            <td className={tdR}>{n0(r.pax)}</td>
            <td className={`${tdR} font-medium`}>
              {r.revenue ? `${cur} ${Math.round(r.revenue).toLocaleString()}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
