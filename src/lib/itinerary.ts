import type { QuoteDayPlan, QuoteItem } from "./types";

function dayKey(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Every calendar date from checkIn up to (and including) checkOut, ISO strings. */
export function datesInRange(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const out: string[] = [];
  for (
    let d = new Date(start);
    dayKey(d) <= dayKey(end);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface DayLine {
  date: string;
  rate: number | null;
}

/**
 * Derives the destination label actually reflected in a quote's items,
 * rather than trusting a single "Destination" field that can go stale on
 * multi-city trips (e.g. Hong Kong + Macau) since it's just whatever the
 * Pax Details dropdown last happened to be set to. Collects every distinct
 * city referenced by hotel/guide/other-service line items; falls back to
 * `fallbackCity` only if no item carries city information at all.
 */
export function computeDestinationLabel(items: QuoteItem[], fallbackCity: string): string {
  const cities = new Set<string>();
  for (const it of items) {
    if (it.kind === "hotel" && it.meta?.pricing) {
      const c = (it.meta.pricing as { city?: string }).city;
      if (c) cities.add(c);
    } else if (it.kind === "guide" && it.meta?.guide) {
      const c = (it.meta.guide as { city?: string }).city;
      if (c) cities.add(c);
    } else if (it.kind === "other" && it.meta?.service) {
      const c = (it.meta.service as { city?: string }).city;
      if (c) cities.add(c);
    }
  }
  return cities.size > 0 ? Array.from(cities).join(" & ") : fallbackCity;
}

/**
 * Builds the day-wise itinerary automatically from whatever's been added so
 * far. Nothing here is manually arranged by the employee — every item slots
 * into the day(s) implied by its own date (single-day items: activity,
 * transport, a one-off service) or its `meta.lines` date spread (multi-day
 * items: a hotel stay, a guide booked for several days).
 */
export function buildDayWiseItinerary(
  checkIn: string,
  checkOut: string,
  items: QuoteItem[],
): QuoteDayPlan[] {
  if (!checkIn || !checkOut) return [];
  const dates = datesInRange(checkIn, checkOut);

  return dates.map((date, i) => {
    const dayItems: QuoteDayPlan["items"] = [];

    for (const item of items) {
      const lines = item.meta?.lines as DayLine[] | undefined;
      if (Array.isArray(lines)) {
        const line = lines.find((l) => l.date === date);
        if (line && line.rate != null) {
          dayItems.push({ kind: item.kind, label: item.label, detail: item.detail, amount: line.rate });
        }
      } else if (item.date === date) {
        dayItems.push({ kind: item.kind, label: item.label, detail: item.detail, amount: item.amount });
      }
    }

    return { dayNumber: i + 1, date, items: dayItems };
  });
}
