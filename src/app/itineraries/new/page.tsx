import ItineraryForm from "@/components/ItineraryForm";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewItineraryPage() {
  await requirePermission("itineraries");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Itinerary</h1>
        <p className="text-sm text-slate-500">
          Describe the trip and let AI build a day-by-day plan.
        </p>
      </div>
      <ItineraryForm />
    </div>
  );
}
