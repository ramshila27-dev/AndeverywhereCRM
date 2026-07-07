import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UserForm from "@/components/UserForm";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  const assignedCount = await prisma.query.count({
    where: { assignees: { some: { id: user.id } } },
  });

  return (
    <div>
      <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to users
      </Link>
      <div className="mt-1 mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
        <span className="text-sm text-slate-500">
          {assignedCount} quer{assignedCount === 1 ? "y" : "ies"} assigned
        </span>
      </div>
      <UserForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status,
        }}
      />
    </div>
  );
}
