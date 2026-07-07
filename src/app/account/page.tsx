import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, GRANTABLE_FEATURES, can, isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const admin = isAdmin(user.roles);
  const features = GRANTABLE_FEATURES.filter((f) => can(user, f.key));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your profile and the features you can access.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-400">Name</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-400">Email</dt>
            <dd className="mt-0.5 text-sm text-slate-700">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-400">Roles</dt>
            <dd className="mt-0.5 text-sm text-slate-700">
              {user.roles.map((r) => ROLE_LABELS[r]).join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-400">Status</dt>
            <dd className="mt-0.5 text-sm text-slate-700">{user.status}</dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Feature access
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {admin && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                Full admin access
              </span>
            )}
            {features.map((f) => (
              <span
                key={f.key}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {f.label}
              </span>
            ))}
            {!admin && features.length === 0 && (
              <span className="text-sm text-slate-500">
                No features granted yet — contact your admin.
              </span>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/account/password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Change password →
          </Link>
        </div>
      </div>
    </div>
  );
}
