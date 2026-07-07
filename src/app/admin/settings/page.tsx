import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Company profile used on client-facing quotations.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Company
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-400">Name</dt>
            <dd className="text-sm font-semibold text-slate-900">{COMPANY.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Website</dt>
            <dd className="text-sm text-slate-700">{COMPANY.website}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Email</dt>
            <dd className="text-sm text-slate-700">{COMPANY.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Phone</dt>
            <dd className="text-sm text-slate-700">{COMPANY.phone}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Offices
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {COMPANY.offices.map((o) => (
            <div key={o.label}>
              <p className="text-sm font-semibold text-slate-800">{o.label}</p>
              {o.lines.map((l) => (
                <p key={l} className="text-xs text-slate-500">
                  {l}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bank details
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(COMPANY.bank).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase text-slate-400">
                {k.replace(/([A-Z])/g, " $1")}
              </dt>
              <dd className="text-sm text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          These values are defined in <code>src/lib/company.ts</code>. An
          editable settings form can be wired up next.
        </p>
      </section>
    </div>
  );
}
