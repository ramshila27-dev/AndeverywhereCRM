// Shared types for the itinerary domain.
// `days` and `tips` are stored on the Itinerary as structured data; these
// types describe the shape the AI produces and the UI consumes.

export interface Activity {
  time: string; // e.g. "09:00" or "Morning"
  title: string;
  description: string;
  location: string;
  category: string; // e.g. "Food", "Sightseeing", "Transport", "Leisure"
  estimatedCost: string; // human-readable, e.g. "$40 pp" or "Free"
}

export interface ItineraryDay {
  day: number;
  date: string; // ISO date (YYYY-MM-DD) or empty string
  title: string;
  activities: Activity[];
}

export interface GeneratedItinerary {
  title: string;
  summary: string;
  days: ItineraryDay[];
  tips: string[];
}

export type Pace = "relaxed" | "balanced" | "packed";

export interface TripInput {
  destination: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  travelers: number;
  budget?: string;
  interests: string[];
  pace: Pace;
  notes?: string;
}

export const INTEREST_OPTIONS = [
  "Food & Dining",
  "History & Culture",
  "Nature & Outdoors",
  "Beaches",
  "Nightlife",
  "Shopping",
  "Art & Museums",
  "Adventure",
  "Relaxation & Wellness",
  "Family-friendly",
] as const;

export const STATUS_OPTIONS = ["draft", "quoted", "booked"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];

// ------------------------------ Quotes -------------------------------------

export const QUOTE_STATUS_OPTIONS = ["draft", "sent", "confirmed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS_OPTIONS)[number];

export type QuoteItemKind = "hotel" | "transfer" | "activity" | "guide" | "other" | "charge";

export type MarkupType = "PERCENT" | "FIXED";

export interface MarkupInput {
  type: MarkupType;
  value: number; // percent (e.g. 15) or a flat currency amount, depending on type
}

// A snapshotted line on a quote. `amount` is the line total in the quote's
// currency; `meta` holds a per-line breakdown for display/audit.
// `date` (single-day items) or `meta.lines[].date` (multi-night items like
// hotel stays) is what the day-wise itinerary groups on.
export interface QuoteItem {
  kind: QuoteItemKind;
  refId: string; // roomTypeId / transferId / activityId / guideId / serviceId
  label: string; // main description
  detail?: string; // e.g. "3 nights · Deluxe Room (2P)"
  date?: string; // ISO date this item applies to (single-day items)
  qty: number;
  unit?: number; // unit rate where meaningful
  amount: number; // line total
  image?: string; // per-item photo (catalog imageUrl) for the PDF
  meta?: Record<string, unknown>;
}

// One entry in the auto-derived day-wise itinerary for a QUOTE (see
// src/lib/itinerary.ts). Distinct from the `ItineraryDay` type above, which
// belongs to the separate free-form AI Itinerary feature.
export interface QuoteDayPlan {
  dayNumber: number;
  date: string;
  items: { kind: QuoteItemKind; label: string; detail?: string; amount: number }[];
}

export interface QuoteTripInput {
  title: string;
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  queryId?: string;
}

// ------------------------------ Query --------------------------------------

export const QUERY_STATUSES = [
  { value: "NEW_QUERY", label: "New Query" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "CONVERTED", label: "Converted" },
  { value: "ON_TRIP", label: "On Trip" },
  { value: "PAST_TRIP", label: "Past Trips" },
  { value: "CANCELED", label: "Canceled" },
  { value: "DROPPED", label: "Dropped" },
] as const;

export type QueryStatusValue = (typeof QUERY_STATUSES)[number]["value"];

export const QUERY_STATUS_LABEL: Record<QueryStatusValue, string> =
  Object.fromEntries(QUERY_STATUSES.map((s) => [s.value, s.label])) as Record<
    QueryStatusValue,
    string
  >;

// Allowed lifecycle transitions. Canceled/Dropped can be reopened to New Query.
export const QUERY_TRANSITIONS: Record<QueryStatusValue, QueryStatusValue[]> = {
  NEW_QUERY: ["IN_PROGRESS", "ON_HOLD", "DROPPED", "CANCELED"],
  IN_PROGRESS: ["ON_HOLD", "CONVERTED", "DROPPED", "CANCELED"],
  ON_HOLD: ["IN_PROGRESS", "CONVERTED", "DROPPED", "CANCELED"],
  CONVERTED: ["ON_TRIP", "ON_HOLD", "CANCELED"],
  ON_TRIP: ["PAST_TRIP", "ON_HOLD"],
  PAST_TRIP: [],
  CANCELED: ["NEW_QUERY"],
  DROPPED: ["NEW_QUERY"],
};

// Tailwind chip styles per status (used in lists and badges).
export const QUERY_STATUS_STYLE: Record<QueryStatusValue, string> = {
  NEW_QUERY: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  ON_TRIP: "bg-teal-100 text-teal-700",
  PAST_TRIP: "bg-slate-200 text-slate-700",
  CANCELED: "bg-rose-100 text-rose-700",
  DROPPED: "bg-slate-100 text-slate-500",
};

export interface Phone {
  code: string; // dialing label, e.g. "91-IN"
  number: string;
}

export const PHONE_CODES = [
  "91-IN",
  "1-US",
  "44-GB",
  "61-AU",
  "65-SG",
  "852-HK",
  "853-MO",
  "971-AE",
  "66-TH",
  "60-MY",
] as const;

export interface AgentInput {
  id?: string;
  companyName: string;
  agentName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface QueryInput {
  source?: string;
  referenceId?: string;
  salesTeam?: string;
  agent?: AgentInput;
  tags: string[];
  destinations: string[];
  startDate?: string;
  nights: number;
  adults: number;
  childAges: number[];
  infants: number;
  totalFoc: number;
  salutation?: string;
  guestName: string;
  phones: Phone[];
  email?: string;
  location?: string;
  comments?: string;
}
