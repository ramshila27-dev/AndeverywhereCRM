import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ItineraryView from "@/components/ItineraryView";
import { requirePermission } from "@/lib/auth";
import type { ItineraryDay } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ItineraryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("itineraries");
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: params.id },
  });

  if (!itinerary) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to itineraries
      </Link>

      <ItineraryView
        id={itinerary.id}
        title={itinerary.title}
        destination={itinerary.destination}
        dateRange={`${fmtDate(itinerary.startDate)} – ${fmtDate(
          itinerary.endDate,
        )}`}
        travelers={itinerary.travelers}
        status={itinerary.status}
        summary={itinerary.summary}
        interests={itinerary.interests}
        notes={itinerary.notes}
        days={(itinerary.days as unknown as ItineraryDay[]) ?? []}
        tips={itinerary.tips}
      />
    </div>
  );
}
