import Link from "next/link";
import UserForm from "@/components/UserForm";

export const dynamic = "force-dynamic";

export default function NewUserPage() {
  return (
    <div>
      <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to users
      </Link>
      <h1 className="mt-1 mb-6 text-2xl font-bold text-slate-900">Add User</h1>
      <UserForm />
    </div>
  );
}
