import type { ItineraryDay } from "@/lib/types";

const categoryColors: Record<string, string> = {
  Food: "bg-rose-50 text-rose-600 border-rose-200",
  Sightseeing: "bg-sky-50 text-sky-600 border-sky-200",
  Transport: "bg-slate-50 text-slate-600 border-slate-200",
  Leisure: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Nature: "bg-green-50 text-green-600 border-green-200",
  Culture: "bg-violet-50 text-violet-600 border-violet-200",
};

function badge(category: string): string {
  return (
    categoryColors[category] ?? "bg-brand-50 text-brand-600 border-brand-200"
  );
}

export default function ItineraryDays({ days }: { days: ItineraryDay[] }) {
  return (
    <div className="space-y-5">
      {days.map((day) => (
        <div
          key={day.day}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="font-semibold text-slate-900">
              Day {day.day}
              {day.title ? ` · ${day.title}` : ""}
            </h3>
            {day.date && (
              <span className="text-sm text-slate-400">{day.date}</span>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {day.activities.map((a, i) => (
              <li key={i} className="flex gap-4 px-4 py-3">
                <div className="w-16 shrink-0 pt-0.5 text-sm font-medium text-slate-500">
                  {a.time}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {a.title}
                    </span>
                    {a.category && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${badge(
                          a.category,
                        )}`}
                      >
                        {a.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {a.description}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-400">
                    {a.location && <span>📍 {a.location}</span>}
                    {a.estimatedCost && <span>💰 {a.estimatedCost}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
