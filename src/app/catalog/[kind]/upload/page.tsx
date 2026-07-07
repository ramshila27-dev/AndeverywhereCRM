import Link from "next/link";
import { notFound } from "next/navigation";
import UploadRatesForm from "@/components/UploadRatesForm";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  hotels: "Upload Hotel Prices",
  transfers: "Upload Transportation Prices",
  activities: "Upload Activity Prices",
};

const FORMATS: Record<string, { intro: string; cols: string[] }> = {
  hotels: {
    intro:
      "One worksheet per hotel. Cell A1 holds “HOTEL NAME | City | 4-STAR”, followed by a SEASON REFERENCE block mapping each season to a date band, then the rate grid and an EXTRAS block.",
    cols: [
      "ROOM CATEGORY — room category name",
      "ROOM TYPE — room type name",
      "Meal Plan — e.g. BB / CP / MAP",
      "Pax — occupancy code (2P, 3P, 4P…)",
      "Season 1 … Season N — net rate per season (1 = not available)",
      "EXTRAS — Extra Bed (Adult), Extra Bed (Child), Child without Bed (CNB)",
    ],
  },
  transfers: {
    intro:
      'A sheet named “Transport”. Row 2 holds the season date band; row 4 lists vehicle types across the season columns.',
    cols: [
      "Duty Code — optional reference",
      "A — from location",
      "B — to location",
      "Service — e.g. Private Transfer - One Way",
      "Distance / Start Time / Duration(mins)",
      "Day Schedule — optional itinerary text",
      "Vehicle columns — net rate per vehicle type per season",
    ],
  },
  activities: {
    intro:
      'A sheet named “Activity” (and optionally “Activity 2”). Row 2 holds the season band; row 4 lists Adult / Child sub-columns.',
    cols: [
      "Name — activity name",
      "Service — category (Attractions Ticket, SIC Transfer…)",
      "Description / Open Time / Close Time / Duration(Mins) / Slots",
      "Adult / Child (age band) — net rate per pax type per season",
    ],
  },
};

export default async function UploadPage({ params }: { params: { kind: string } }) {
  await requirePermission("rates");
  const { kind } = params;
  if (!TITLES[kind]) notFound();
  const fmt = FORMATS[kind];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/catalog?tab=${kind}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{TITLES[kind]}</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <UploadRatesForm kind={kind} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">XLS / Sheet Format</h2>
        <p className="mt-1 text-sm text-slate-600">{fmt.intro}</p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
          {fmt.cols.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Re-uploading updates matching items and their rates. A rate of 1 (or
          blank) means "not available".
        </p>
      </div>
    </div>
  );
}
