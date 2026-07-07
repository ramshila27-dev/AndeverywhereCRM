import Link from "next/link";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import { FEATURES, can, isAdmin, ROLE_LABELS } from "@/lib/permissions";
import type { User } from "@prisma/client";

export default function Navbar({ user }: { user: User }) {
  const admin = isAdmin(user.roles);

  // Nav links: itineraries + queries + quotes + rates + reports the user can
  // access. Admin tools live under the user menu, not the main bar.
  const navFeatures = FEATURES.filter(
    (f) => !f.adminOnly && can(user, f.key),
  );

  const roleLabel =
    user.roles.map((r) => ROLE_LABELS[r]).join(" · ") || "Employee";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      {/* red → blue accent hairline */}
      <div className="h-1 bg-gradient-to-r from-accent-500 via-accent-500 to-brand-600" />
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {navFeatures.map((f) => (
            <Link
              key={f.key}
              href={f.href}
              className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700"
            >
              {f.key === "rates" ? "Rates" : f.label}
            </Link>
          ))}
          {admin && (
            <Link
              href="/admin/users"
              className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-brand-700"
            >
              Admin
            </Link>
          )}
          {can(user, "queries") && (
            <Link
              href="/queries/new"
              className="ml-1 rounded-md bg-accent-500 px-3.5 py-1.5 font-semibold text-white shadow-sm transition hover:bg-accent-600"
            >
              + New Query
            </Link>
          )}
          <UserMenu name={user.name} email={user.email} roleLabel={roleLabel} />
        </nav>
      </div>
    </header>
  );
}
