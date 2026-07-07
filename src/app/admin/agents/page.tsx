import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  let agents: Awaited<ReturnType<typeof prisma.agent.findMany>> = [];
  let dbError = false;
  try {
    agents = await prisma.agent.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { queries: true } } },
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Agents</h1>
        <p className="text-sm text-slate-500">
          Every B2B agent saved from the Add Query form — searched and auto-filled from here.
        </p>
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Could not reach the database.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Agent Name</th>
              <th className="px-4 py-2">Mobile</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Queries</th>
              <th className="px-4 py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!dbError && agents.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No agents added yet.</td></tr>
            )}
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{a.companyName}</td>
                <td className="px-4 py-3 text-slate-700">{a.agentName}</td>
                <td className="px-4 py-3 text-slate-700">{a.mobile}</td>
                <td className="px-4 py-3 text-slate-500">{a.email || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{a.city || "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {(a as unknown as { _count: { queries: number } })._count.queries}
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(a.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
