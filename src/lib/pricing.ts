// Pricing engine for building quotes from the contracting-rates catalog.
//
// The functions here are pure and operate on already-fetched catalog data so
// they are easy to test and reuse from both API routes and server components.

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UTC midnight timestamp for a Date, ignoring any time component. */
function dayKey(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * The list of nights for a stay: every date from check-in up to (but not
 * including) check-out. `checkIn`/`checkOut` are ISO date strings (YYYY-MM-DD).
 */
export function nightsBetween(checkIn: string, checkOut: string): Date[] {
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const out: Date[] = [];
  for (
    let d = new Date(start);
    dayKey(d) < dayKey(end);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(new Date(d));
  }
  return out;
}

export interface SeasonLike {
  code: string;
  startDate: Date | string;
  endDate: Date | string;
  daysOfWeek?: string | null;
}

/** Does a season's date band (and optional day-of-week filter) cover a date? */
export function seasonMatches(season: SeasonLike, date: Date): boolean {
  const start = dayKey(new Date(season.startDate));
  const end = dayKey(new Date(season.endDate));
  const day = dayKey(date);
  if (day < start || day > end) return false;

  if (season.daysOfWeek) {
    const allowed = season.daysOfWeek
      .split(",")
      .map((x) => x.trim().slice(0, 3).toLowerCase())
      .filter(Boolean);
    const wd = WEEKDAYS[date.getUTCDay()].toLowerCase();
    if (allowed.length && !allowed.includes(wd)) return false;
  }
  return true;
}

export interface RateLike {
  netRate: number | string | null;
  season: SeasonLike;
}

export interface NightLine {
  date: string;
  seasonCode: string | null;
  rate: number | null;
}

export interface StayPricing {
  nights: number;
  lines: NightLine[];
  subtotal: number;
  unavailableNights: number;
}

/**
 * Price a hotel stay night-by-night. For each night, the applicable season is
 * resolved from the room's rates; a night with no matching season or a null
 * rate (the sheets' "not available" sentinel) is flagged as unavailable.
 */
export function priceStay(
  rates: RateLike[],
  checkIn: string,
  checkOut: string,
): StayPricing {
  const lines: NightLine[] = nightsBetween(checkIn, checkOut).map((d) => {
    const match = rates.find((r) => seasonMatches(r.season, d));
    const rate =
      match && match.netRate != null ? Number(match.netRate) : null;
    return {
      date: d.toISOString().slice(0, 10),
      seasonCode: match?.season.code ?? null,
      rate: Number.isFinite(rate as number) ? rate : null,
    };
  });

  const subtotal = lines.reduce((s, l) => s + (l.rate ?? 0), 0);
  const unavailableNights = lines.filter((l) => l.rate == null).length;
  return { nights: lines.length, lines, subtotal, unavailableNights };
}

/**
 * Splits a quote's total into a per-adult and per-child figure for display
 * on the quotation. Activities are the only line items priced differently
 * per pax type in this data model, so their adult/child amounts are split
 * exactly; everything else (hotel, transport, guide, other services,
 * charges) isn't naturally divisible by pax type (a hotel room doesn't cost
 * a different amount per occupant), so that portion is divided evenly
 * across all travelers. The same markup ratio (total/subtotal) is applied
 * uniformly to both portions. This is a reasonable industry-standard
 * approximation, not a precise per-person cost allocation.
 */
export function computePerPaxBreakdown(
  items: { kind: string; meta?: Record<string, unknown> | null }[],
  subtotal: number,
  total: number,
  adults: number,
  children: number,
): { perAdult: number; perChild: number | null } {
  const markupRatio = subtotal > 0 ? total / subtotal : 1;

  let activityAdultSubtotal = 0;
  let activityChildSubtotal = 0;
  for (const it of items) {
    if (it.kind !== "activity" || !it.meta) continue;
    const adultRate = Number(it.meta.adultRate) || 0;
    const childRate = Number(it.meta.childRate) || 0;
    const aCount = Number(it.meta.adults) || 0;
    const cCount = Number(it.meta.children) || 0;
    activityAdultSubtotal += adultRate * aCount;
    activityChildSubtotal += childRate * cCount;
  }

  const sharedSubtotal = subtotal - activityAdultSubtotal - activityChildSubtotal;
  const totalPax = Math.max(1, adults + children);
  const sharedPerHead = (sharedSubtotal * markupRatio) / totalPax;

  const perAdult = adults > 0
    ? sharedPerHead + (activityAdultSubtotal * markupRatio) / adults
    : 0;
  const perChild = children > 0
    ? sharedPerHead + (activityChildSubtotal * markupRatio) / children
    : null;

  return { perAdult, perChild };
}

/** Format a money amount for display, e.g. 1234.5 -> "HK$1,234.50". */
export function formatMoney(amount: number, currency = "HKD"): string {
  try {
    return new Intl.NumberFormat("en-HK", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Applies a markup to a subtotal. PERCENT adds `value`% of the subtotal;
 * FIXED adds a flat amount regardless of subtotal size. Never returns a
 * total below the subtotal (a negative markup value is clamped to 0) — a
 * quote should never show a total lower than its net cost by accident.
 */
export function applyMarkup(
  subtotal: number,
  markupType: "PERCENT" | "FIXED",
  markupValue: number,
): { markupAmount: number; total: number } {
  const value = Math.max(0, Number(markupValue) || 0);
  const markupAmount = markupType === "FIXED" ? value : subtotal * (value / 100);
  return { markupAmount, total: subtotal + markupAmount };
}
