import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// All /admin pages require an admin; this guards the whole section once.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 border-b border-slate-200">
        <Link
          href="/admin/users"
          className="border-b-2 border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700"
        >
          Users
        </Link>
        <Link
          href="/admin/settings"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Settings
        </Link>
        <Link
          href="/admin/currency"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Currency
        </Link>
        <Link
          href="/admin/agents"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Agents
        </Link>
      </div>
      {children}
    </div>
  );
}
