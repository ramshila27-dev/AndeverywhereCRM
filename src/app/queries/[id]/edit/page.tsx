import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QueryForm from "@/components/QueryForm";
import { requirePermission } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { Phone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditQueryPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("queries");
  if (!isAdmin(user.roles)) redirect(`/queries/${params.id}`);

  const query = await prisma.query.findUnique({
    where: { id: params.id },
    include: { agent: true },
  });
  if (!query) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/queries/${query.id}`} className="inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Back to query
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Query</h1>
        <p className="text-sm text-slate-500">Changes save back to this same query.</p>
      </div>
      <QueryForm
        initial={{
          id: query.id,
          source: query.source ?? undefined,
          referenceId: query.referenceId ?? undefined,
          salesTeam: query.salesTeam ?? undefined,
          agent: query.agent
            ? {
                companyName: query.agent.companyName,
                agentName: query.agent.agentName,
                mobile: query.agent.mobile,
                email: query.agent.email ?? undefined,
                address: query.agent.address ?? undefined,
                city: query.agent.city ?? undefined,
                pincode: query.agent.pincode ?? undefined,
              }
            : undefined,
          tags: query.tags,
          destinations: query.destinations,
          startDate: query.startDate ? query.startDate.toISOString().slice(0, 10) : undefined,
          nights: query.nights,
          adults: query.adults,
          childAges: query.childAges,
          infants: query.infants,
          totalFoc: query.totalFoc,
          salutation: query.salutation ?? undefined,
          guestName: query.guestName,
          phones: (query.phones as unknown as Phone[]) ?? [],
          email: query.email ?? undefined,
          location: query.location ?? undefined,
          comments: query.comments ?? undefined,
        }}
      />
    </div>
  );
}
