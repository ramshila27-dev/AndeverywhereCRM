"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, applyMarkup } from "@/lib/pricing";
import { buildDayWiseItinerary, datesInRange } from "@/lib/itinerary";
import TokenInput from "./TokenInput";
import type { MarkupInput, MarkupType, QuoteItem } from "@/lib/types";

// ---- API response shapes ----
interface CityOpt { city: string; hotels: number; }
interface HotelOpt { id: string; name: string; city: string; starRating: number | null; currency: string; roomTypes: number; }
interface RoomOpt { id: string; category: string; name: string; mealPlan: string; maxPax: number; }
interface NightLine { date: string; seasonCode: string | null; rate: number | null; }
interface HotelPricing { roomTypeId: string; hotel: string; city: string; currency: string; image: string | null; room: string; nights: number; lines: NightLine[]; subtotal: number; unavailableNights: number; }
interface VehicleOpt { vehicleTypeId: string; name: string; maxPax: number | null; netRate: number; }
interface TransferOpt { id: string; fromLocation: string; toLocation: string; service: string; durationMins: number | null; daySchedule: string | null; image: string | null; vehicles: VehicleOpt[]; }
interface ActivityOpt { id: string; name: string; service: string; description: string | null; image: string | null; childAgeFrom: number | null; childAgeTo: number | null; adultRate: number | null; childRate: number | null; }
interface GuideOpt { id: string; name: string; city: string; language: string | null; image: string | null; dailyRate: number; currency: string; }
interface ServiceOpt { id: string; name: string; city: string; description: string | null; unitLabel: string; rate: number; image: string | null; currency: string; }

interface AddedHotel { uid: number; pricing: HotelPricing; checkIn: string; }
interface AddedTransfer { uid: number; transfer: TransferOpt; vehicleTypeId: string; qty: number; date: string; }
interface AddedActivity { uid: number; activity: ActivityOpt; adults: number; children: number; date: string; }
interface AddedGuide { uid: number; guide: GuideOpt; startDate: string; endDate: string; guideName: string; comment: string; price: number; }
interface AddedService { uid: number; service: ServiceOpt; startDate: string; endDate: string; details: string; price: number; }
interface AddedCharge { uid: number; label: string; description: string; location: string; date: string; amount: number; }

/**
 * Rebuilds the interactive "Added*" lists from a previously-saved quote's
 * flat QuoteItem[] snapshot. This is what makes editing an existing quote
 * and "import a previous quote" both possible without re-fetching the
 * catalog — every item's `meta` carries everything needed to reconstruct it
 * (see the meta assignments in the `items` useMemo below). Any item whose
 * meta is missing/malformed is skipped rather than crashing the builder.
 */
function reconstructAddedLists(items: QuoteItem[], uidStart: number) {
  let nextUid = uidStart;
  const hotels: AddedHotel[] = [];
  const transfers: AddedTransfer[] = [];
  const activities: AddedActivity[] = [];
  const guides: AddedGuide[] = [];
  const services: AddedService[] = [];
  const charges: AddedCharge[] = [];

  for (const it of items) {
    try {
      if (it.kind === "hotel" && it.meta?.pricing) {
        hotels.push({ uid: nextUid++, pricing: it.meta.pricing as HotelPricing, checkIn: (it.meta.checkIn as string) ?? it.date ?? "" });
      } else if (it.kind === "transfer" && it.meta?.transfer) {
        transfers.push({ uid: nextUid++, transfer: it.meta.transfer as TransferOpt, vehicleTypeId: it.meta.vehicleTypeId as string, qty: it.qty, date: it.date ?? "" });
      } else if (it.kind === "activity" && it.meta?.activity) {
        activities.push({ uid: nextUid++, activity: it.meta.activity as ActivityOpt, adults: (it.meta.adults as number) ?? 0, children: (it.meta.children as number) ?? 0, date: it.date ?? "" });
      } else if (it.kind === "guide" && it.meta?.guide) {
        const legacyDays = it.meta.days as number | undefined;
        const start = (it.meta.startDate as string) ?? it.date ?? "";
        guides.push({
          uid: nextUid++,
          guide: it.meta.guide as GuideOpt,
          startDate: start,
          endDate: (it.meta.endDate as string) ?? start,
          guideName: (it.meta.guideName as string) ?? "",
          comment: (it.meta.comment as string) ?? "",
          price: (it.meta.price as number) ?? it.amount ?? (legacyDays ? legacyDays * (it.meta.guide as GuideOpt).dailyRate : (it.meta.guide as GuideOpt).dailyRate),
        });
      } else if (it.kind === "other" && it.meta?.service) {
        const start = (it.meta.startDate as string) ?? it.date ?? "";
        services.push({
          uid: nextUid++,
          service: it.meta.service as ServiceOpt,
          startDate: start,
          endDate: (it.meta.endDate as string) ?? start,
          details: (it.meta.details as string) ?? "",
          price: (it.meta.price as number) ?? it.amount ?? (it.meta.service as ServiceOpt).rate,
        });
      } else if (it.kind === "charge") {
        charges.push({
          uid: nextUid++,
          label: it.label,
          description: (it.meta?.description as string) ?? "",
          location: (it.meta?.location as string) ?? "",
          date: it.date ?? "",
          amount: it.unit ?? it.amount,
        });
      }
    } catch {
      // Malformed/legacy item snapshot — skip it rather than break the whole load.
    }
  }
  return { hotels, transfers, activities, guides, services, charges, nextUid };
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";

function SectionBody({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-paper-200 bg-white p-6 shadow-sm shadow-brand-900/[0.04]">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent-500 to-brand-800" />
      <h2 className="font-display text-xl font-semibold tracking-tight text-brand-900">{title}</h2>
      {subtitle && <p className="mb-4 mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

type TabId =
  | "overview" | "passengers" | "hotels" | "transport" | "activities"
  | "guide" | "otherServices" | "additionalCharges" | "inclusionExclusion" | "markup";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "passengers", label: "Passengers" },
  { id: "hotels", label: "Hotels" },
  { id: "transport", label: "Transport" },
  { id: "activities", label: "Activities" },
  { id: "guide", label: "Guide" },
  { id: "otherServices", label: "Other Services" },
  { id: "additionalCharges", label: "Additional Charges" },
  { id: "inclusionExclusion", label: "Inclusion/Exclusion" },
  { id: "markup", label: "Markup" },
];

export interface QuoteInitial {
  quoteId?: string; // present when editing an existing quote instead of creating a new one
  queryId?: string;
  title?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  items?: QuoteItem[]; // pre-loaded line items, for edit mode or "import previous quote"
  markup?: MarkupInput;
  inclusions?: string[];
  exclusions?: string[];
}

export default function QuoteBuilder({ initial }: { initial?: QuoteInitial }) {
  const router = useRouter();
  const uid = useRef(1);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // ---------------- Passengers / trip basics ----------------
  const [title, setTitle] = useState(initial?.title ?? "");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [budgetPerPax, setBudgetPerPax] = useState<number>(0); // 0 = no limit
  const queryId = initial?.queryId;

  const tripDates = useMemo(
    () => (checkIn && checkOut ? datesInRange(checkIn, checkOut) : []),
    [checkIn, checkOut],
  );

  const [cities, setCities] = useState<CityOpt[]>([]);

  // ---------------- Hotels ----------------
  // hotelCity is deliberately independent from the Pax Details `city` field.
  // A trip can span multiple destinations (e.g. Hong Kong + Macau); if hotel
  // search reused the single trip-level city, adding hotels for a second
  // destination would silently overwrite the first, which is exactly the
  // "last selected destination" bug this fixes.
  const [hotelCity, setHotelCity] = useState("");
  const [hotels, setHotels] = useState<HotelOpt[]>([]);
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [hotelId, setHotelId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayNights, setStayNights] = useState(1);
  const [pricing, setPricing] = useState<HotelPricing | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [addedHotels, setAddedHotels] = useState<AddedHotel[]>([]);

  // ---------------- Activities ----------------
  const [activitiesCat, setActivitiesCat] = useState<ActivityOpt[]>([]);
  const [activityQ, setActivityQ] = useState("");
  const [addedActivities, setAddedActivities] = useState<AddedActivity[]>([]);

  // ---------------- Transport ----------------
  const [transfersCat, setTransfersCat] = useState<TransferOpt[]>([]);
  const [transferQ, setTransferQ] = useState("");
  const [addedTransfers, setAddedTransfers] = useState<AddedTransfer[]>([]);

  // ---------------- Guide ----------------
  const [guidesCat, setGuidesCat] = useState<GuideOpt[]>([]);
  const [guideQ, setGuideQ] = useState("");
  const [addedGuides, setAddedGuides] = useState<AddedGuide[]>([]);

  // ---------------- Other Services ----------------
  const [servicesCat, setServicesCat] = useState<ServiceOpt[]>([]);
  const [serviceQ, setServiceQ] = useState("");
  const [addedServices, setAddedServices] = useState<AddedService[]>([]);

  // ---------------- Additional Charges (ad-hoc, no catalog) ----------------
  const [chargeLabel, setChargeLabel] = useState("");
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [addedCharges, setAddedCharges] = useState<AddedCharge[]>([]);

  // ---------------- Inclusion / Exclusion ----------------
  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);

  // ---------------- Markup ----------------
  const [markupType, setMarkupType] = useState<MarkupType>("PERCENT");
  const [markupValue, setMarkupValue] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = !!initial?.quoteId;

  // Edit mode: reconstruct every Added* list from the quote's saved items on
  // first load, so the employee can pick up exactly where the quote left off.
  useEffect(() => {
    if (!isEditMode || !initial?.items) return;
    const rebuilt = reconstructAddedLists(initial.items, uid.current);
    setAddedHotels(rebuilt.hotels);
    setAddedTransfers(rebuilt.transfers);
    setAddedActivities(rebuilt.activities);
    setAddedGuides(rebuilt.guides);
    setAddedServices(rebuilt.services);
    setAddedCharges(rebuilt.charges);
    uid.current = rebuilt.nextUid;
    if (initial.markup) {
      setMarkupType(initial.markup.type);
      setMarkupValue(initial.markup.value);
    }
    if (initial.inclusions) setInclusions(initial.inclusions);
    if (initial.exclusions) setExclusions(initial.exclusions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Import a previous quote (create mode only) ----------------
  interface ImportableQuote {
    id: string; title: string; city: string; total: number; currency: string;
    createdAt: string; checkIn: string; checkOut: string; adults: number; children: number;
    markupType: MarkupType; markupValue: number; inclusions: string[]; exclusions: string[];
    items: QuoteItem[];
  }
  const [importSearch, setImportSearch] = useState("");
  const [importResults, setImportResults] = useState<ImportableQuote[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (isEditMode) return;
    const t = setTimeout(() => {
      fetch(`/api/quotes${importSearch ? `?search=${encodeURIComponent(importSearch)}` : ""}`)
        .then((r) => r.json())
        .then((d: ImportableQuote[]) => setImportResults(Array.isArray(d) ? d : []))
        .catch(() => setImportResults([]));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSearch, importOpen]);

  function importQuote(q: ImportableQuote) {
    const rebuilt = reconstructAddedLists(q.items ?? [], uid.current);
    setAddedHotels(rebuilt.hotels);
    setAddedTransfers(rebuilt.transfers);
    setAddedActivities(rebuilt.activities);
    setAddedGuides(rebuilt.guides);
    setAddedServices(rebuilt.services);
    setAddedCharges(rebuilt.charges);
    uid.current = rebuilt.nextUid;
    setTitle(`${q.title} (copy)`);
    setCity(q.city);
    setCheckIn(q.checkIn.slice(0, 10));
    setCheckOut(q.checkOut.slice(0, 10));
    setAdults(q.adults);
    setChildren(q.children);
    setMarkupType(q.markupType ?? "PERCENT");
    setMarkupValue(Number(q.markupValue) || 0);
    setInclusions(q.inclusions ?? []);
    setExclusions(q.exclusions ?? []);
    setImportOpen(false);
  }

  const currency = pricing?.currency || addedHotels[0]?.pricing.currency || "HKD";

  // Load cities once. If a destination was prefilled from a query, snap it
  // to the matching catalog city.
  useEffect(() => {
    fetch("/api/catalog/cities")
      .then((r) => r.json())
      .then((cs: CityOpt[]) => {
        setCities(cs);
        if (initial?.city) {
          const match = cs.find((c) => c.city.toLowerCase() === initial.city!.toLowerCase());
          if (match) setCity(match.city);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/catalog/transfers").then((r) => r.json()).then(setTransfersCat).catch(() => {});
    fetch("/api/catalog/activities").then((r) => r.json()).then(setActivitiesCat).catch(() => {});
  }, []);

  useEffect(() => {
    setGuidesCat([]);
    setServicesCat([]);
    if (!city) return;
    fetch(`/api/catalog/guides?city=${encodeURIComponent(city)}`).then((r) => r.json()).then(setGuidesCat).catch(() => {});
    fetch(`/api/catalog/other-services?city=${encodeURIComponent(city)}`).then((r) => r.json()).then(setServicesCat).catch(() => {});
  }, [city]);

  useEffect(() => {
    if (checkIn && !stayCheckIn) setStayCheckIn(checkIn);
  }, [checkIn, stayCheckIn]);

  // Default the Hotels tab's destination to the trip's Destination once,
  // the first time it becomes available — after that, the employee is free
  // to change it independently (e.g. to add a Macau stay on an HK+Macau trip)
  // without it ever being overwritten by the Pax Details field again.
  useEffect(() => {
    if (city && !hotelCity) setHotelCity(city);
  }, [city, hotelCity]);

  useEffect(() => {
    setHotels([]); setHotelId(""); setRooms([]); setRoomId(""); setPricing(null);
    if (!hotelCity) return;
    fetch(`/api/catalog/hotels?city=${encodeURIComponent(hotelCity)}`).then((r) => r.json()).then(setHotels).catch(() => {});
  }, [hotelCity]);

  useEffect(() => {
    setRooms([]); setRoomId(""); setPricing(null);
    if (!hotelId) return;
    fetch(`/api/catalog/hotels/${hotelId}/rooms`).then((r) => r.json()).then(setRooms).catch(() => {});
  }, [hotelId]);

  const stayCheckOut = useMemo(() => {
    if (!stayCheckIn || stayNights < 1) return "";
    const d = new Date(`${stayCheckIn}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + stayNights);
    return d.toISOString().slice(0, 10);
  }, [stayCheckIn, stayNights]);

  useEffect(() => {
    setPricing(null);
    if (!roomId || !stayCheckIn || !stayCheckOut) return;
    setPricingBusy(true);
    fetch("/api/pricing/hotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomTypeId: roomId, checkIn: stayCheckIn, checkOut: stayCheckOut }),
    })
      .then((r) => r.json())
      .then((d) => setPricing(d.error ? null : d))
      .catch(() => setPricing(null))
      .finally(() => setPricingBusy(false));
  }, [roomId, stayCheckIn, stayCheckOut]);

  const avgNightlyOverBudget =
    budgetPerPax > 0 && pricing ? pricing.subtotal / pricing.nights / Math.max(1, adults) > budgetPerPax : false;

  const filteredTransfers = useMemo(() => {
    const q = transferQ.toLowerCase();
    return transfersCat
      .filter((t) => t.vehicles.length > 0)
      .filter((t) => !q || `${t.fromLocation} ${t.toLocation} ${t.service}`.toLowerCase().includes(q))
      .filter((t) => !budgetPerPax || t.vehicles.some((v) => v.netRate <= budgetPerPax * Math.max(1, adults)))
      .slice(0, 25);
  }, [transfersCat, transferQ, budgetPerPax, adults]);

  const filteredActivities = useMemo(() => {
    const q = activityQ.toLowerCase();
    return activitiesCat
      .filter((a) => a.adultRate != null || a.childRate != null)
      .filter((a) => !q || `${a.name} ${a.service}`.toLowerCase().includes(q))
      .filter((a) => !budgetPerPax || (a.adultRate ?? 0) <= budgetPerPax)
      .slice(0, 25);
  }, [activitiesCat, activityQ, budgetPerPax]);

  const filteredGuides = useMemo(() => {
    const q = guideQ.toLowerCase();
    return guidesCat
      .filter((g) => !q || `${g.name} ${g.language ?? ""}`.toLowerCase().includes(q))
      .filter((g) => !budgetPerPax || g.dailyRate <= budgetPerPax * Math.max(1, adults))
      .slice(0, 25);
  }, [guidesCat, guideQ, budgetPerPax, adults]);

  const filteredServices = useMemo(() => {
    const q = serviceQ.toLowerCase();
    return servicesCat
      .filter((s) => !q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q))
      .filter((s) => !budgetPerPax || s.rate <= budgetPerPax * Math.max(1, adults))
      .slice(0, 25);
  }, [servicesCat, serviceQ, budgetPerPax, adults]);

  // ---- line items (flat snapshot saved with the quote) ----
  const items = useMemo<QuoteItem[]>(() => {
    const out: QuoteItem[] = [];

    for (const ah of addedHotels) {
      out.push({
        kind: "hotel",
        refId: ah.pricing.roomTypeId,
        label: `${ah.pricing.hotel} — ${ah.pricing.room}`,
        detail: `${ah.pricing.nights - ah.pricing.unavailableNights} of ${ah.pricing.nights} night(s) priced, from ${ah.checkIn}`,
        date: ah.checkIn,
        qty: ah.pricing.nights,
        amount: ah.pricing.subtotal,
        image: ah.pricing.image ?? undefined,
        meta: { lines: ah.pricing.lines, pricing: ah.pricing, checkIn: ah.checkIn },
      });
    }
    for (const at of addedTransfers) {
      const v = at.transfer.vehicles.find((x) => x.vehicleTypeId === at.vehicleTypeId);
      if (!v) continue;
      out.push({
        kind: "transfer",
        refId: at.transfer.id,
        label: `${at.transfer.fromLocation} → ${at.transfer.toLocation}`,
        detail: `${at.transfer.service} · ${v.name} × ${at.qty}`,
        date: at.date,
        qty: at.qty,
        unit: v.netRate,
        amount: v.netRate * at.qty,
        image: at.transfer.image ?? undefined,
        meta: { transfer: at.transfer, vehicleTypeId: at.vehicleTypeId },
      });
    }
    for (const aa of addedActivities) {
      const ar = aa.activity.adultRate ?? 0;
      const cr = aa.activity.childRate ?? 0;
      const amount = ar * aa.adults + cr * aa.children;
      out.push({
        kind: "activity",
        refId: aa.activity.id,
        label: aa.activity.name,
        detail: `${aa.adults} adult(s)${aa.children ? `, ${aa.children} child(ren)` : ""}`,
        date: aa.date,
        qty: aa.adults + aa.children,
        amount,
        image: aa.activity.image ?? undefined,
        meta: { adults: aa.adults, children: aa.children, adultRate: ar, childRate: cr, activity: aa.activity },
      });
    }
    for (const ag of addedGuides) {
      const dayList = datesInRange(ag.startDate, ag.endDate);
      const perDay = dayList.length > 0 ? ag.price / dayList.length : 0;
      const lines = dayList.map((date) => ({ date, rate: perDay }));
      const displayName = ag.guideName.trim() || "Tour guide";
      out.push({
        kind: "guide",
        refId: ag.guide.id,
        label: displayName,
        detail: `${ag.startDate} to ${ag.endDate}${ag.comment ? ` — ${ag.comment}` : ""}`,
        date: ag.startDate,
        qty: 1,
        unit: ag.price,
        amount: ag.price,
        image: ag.guide.image ?? undefined,
        meta: { lines, guide: ag.guide, startDate: ag.startDate, endDate: ag.endDate, guideName: ag.guideName, comment: ag.comment, price: ag.price },
      });
    }
    for (const as of addedServices) {
      out.push({
        kind: "other",
        refId: as.service.id,
        label: as.service.name,
        detail: `${as.startDate} to ${as.endDate}${as.details ? ` — ${as.details}` : ""}`,
        date: as.startDate,
        qty: 1,
        unit: as.price,
        amount: as.price,
        image: as.service.image ?? undefined,
        meta: { service: as.service, startDate: as.startDate, endDate: as.endDate, details: as.details, price: as.price },
      });
    }
    for (const ac of addedCharges) {
      out.push({
        kind: "charge",
        refId: `charge-${ac.uid}`,
        label: ac.label,
        detail: [ac.description, ac.location].filter(Boolean).join(" — "),
        date: ac.date,
        qty: 1,
        unit: ac.amount,
        amount: ac.amount,
        meta: { description: ac.description, location: ac.location },
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addedHotels, addedTransfers, addedActivities, addedGuides, addedServices, addedCharges]);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const { markupAmount, total } = useMemo(
    () => applyMarkup(subtotal, markupType, markupValue),
    [subtotal, markupType, markupValue],
  );

  const dayWiseItinerary = useMemo(
    () => buildDayWiseItinerary(checkIn, checkOut, items),
    [checkIn, checkOut, items],
  );

  function addHotel() {
    if (!pricing || pricing.subtotal <= 0) return;
    setAddedHotels((prev) => [...prev, { uid: uid.current++, pricing, checkIn: stayCheckIn }]);
    setPricing(null);
    setRoomId("");
  }
  function addTransfer(t: TransferOpt) {
    setAddedTransfers((prev) => [
      ...prev,
      { uid: uid.current++, transfer: t, vehicleTypeId: t.vehicles[0].vehicleTypeId, qty: 1, date: checkIn || tripDates[0] || "" },
    ]);
  }
  function addActivity(a: ActivityOpt) {
    setAddedActivities((prev) => [
      ...prev,
      { uid: uid.current++, activity: a, adults, children, date: checkIn || tripDates[0] || "" },
    ]);
  }
  function addGuide(g: GuideOpt) {
    const start = checkIn || tripDates[0] || "";
    setAddedGuides((prev) => [
      ...prev,
      { uid: uid.current++, guide: g, startDate: start, endDate: start, guideName: "", comment: "", price: g.dailyRate },
    ]);
  }
  function addService(s: ServiceOpt) {
    const start = checkIn || tripDates[0] || "";
    setAddedServices((prev) => [
      ...prev,
      { uid: uid.current++, service: s, startDate: start, endDate: start, details: "", price: s.rate },
    ]);
  }
  function addCharge() {
    if (!chargeLabel.trim() || chargeAmount <= 0) return;
    setAddedCharges((prev) => [
      ...prev,
      { uid: uid.current++, label: chargeLabel.trim(), description: "", location: "", date: checkIn || tripDates[0] || "", amount: chargeAmount },
    ]);
    setChargeLabel("");
    setChargeAmount(0);
  }

  async function save() {
    setError(null);
    if (!city || !checkIn || !checkOut) { setError("Destination and travel dates are required."); return; }
    if (items.length === 0) { setError("Add at least one item (hotel, activity, transport, guide, service, or charge)."); return; }
    setSaving(true);
    try {
      const payload = {
        trip: { title, city, checkIn, checkOut, adults, children, queryId },
        items,
        markup: { type: markupType, value: markupValue },
        inclusions,
        exclusions,
      };
      const res = await fetch(isEditMode ? `/api/quotes/${initial!.quoteId}` : "/api/quotes", {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      router.push(`/quotes/${isEditMode ? initial!.quoteId : data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <>
      {!isEditMode && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {importOpen ? "▾" : "▸"} Import a previous quote
          </button>
          {importOpen && (
            <div className="mt-3">
              <input
                className={inputClass}
                placeholder="Search by title or destination…"
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
              />
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
                {importResults.map((q) => (
                  <li key={q.id}>
                    <button
                      onClick={() => importQuote(q)}
                      className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span>
                        {q.title} <span className="text-slate-400">· {q.city}</span>
                      </span>
                      <span className="text-slate-500">{formatMoney(q.total, q.currency)}</span>
                    </button>
                  </li>
                ))}
                {importResults.length === 0 && (
                  <p className="px-1 py-2 text-sm text-slate-400">No saved quotes match yet.</p>
                )}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                Importing copies every hotel/activity/transport/guide/service, dates, pax, markup, and
                inclusion/exclusion lists into this new quote — nothing on the original is changed.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[190px_1fr_340px]">
      {/* Tab nav */}
      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-paper-200 bg-white p-2 lg:flex-col lg:overflow-visible">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-brand-800 text-white shadow-sm"
                : "text-slate-600 hover:bg-paper-100 hover:text-brand-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Active tab content */}
      <div className="space-y-5">
        {activeTab === "overview" && (
          <SectionBody title="Overview" subtitle="Auto-generated from everything added across the other tabs — nothing to arrange manually here.">
            {dayWiseItinerary.length === 0 && (
              <p className="text-sm text-slate-400">Set Check-in and Check-out under Passengers to see the day-wise plan.</p>
            )}
            <div>
              {dayWiseItinerary.map((day, idx) => (
                <div key={day.date} className="flex gap-4">
                  {/* journey rail: a numbered stop on the route, connected to the next */}
                  <div className="flex flex-col items-center">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-800 font-display text-xs font-semibold text-white shadow-sm">
                      {day.dayNumber}
                    </span>
                    {idx < dayWiseItinerary.length - 1 && (
                      <span className="my-1 w-0 flex-1 border-l-2 border-dashed border-brand-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm shadow-brand-900/[0.03]">
                      <p className="mb-2 font-display text-sm font-semibold text-brand-900">{day.date}</p>
                      {day.items.length === 0 ? (
                        <p className="text-xs text-slate-400">Nothing added for this day yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {day.items.map((it, i) => (
                            <li key={i} className="flex justify-between text-sm">
                              <span>
                                <span className="mr-1 rounded bg-paper-100 px-1.5 py-0.5 text-[10px] uppercase text-brand-700">{it.kind}</span>
                                {it.label}
                              </span>
                              <span className="text-slate-600">{formatMoney(it.amount, currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionBody>
        )}

        {activeTab === "passengers" && (
          <SectionBody title="Passengers" subtitle="Trip basics — dates, destination, travelers, and an optional budget to narrow every catalog tab.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Quote title</label>
                <input className={inputClass} placeholder="e.g. Sharma family — Hong Kong" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Destination</label>
                <select className={inputClass} value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Select destination…</option>
                  {cities.map((c) => (<option key={c.city} value={c.city}>{c.city} ({c.hotels})</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Adults</label>
                  <input type="number" min={1} className={inputClass} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Children</label>
                  <input type="number" min={0} className={inputClass} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Check-in</label>
                <input type="date" className={inputClass} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Check-out</label>
                <input type="date" className={inputClass} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Budget per pax <span className="text-slate-400">(optional — filters Activities, Transport, Guide, and Other Services to items within this per-person cap)</span>
                </label>
                <input type="number" min={0} className={inputClass} placeholder="Leave 0 for no limit" value={budgetPerPax || ""} onChange={(e) => setBudgetPerPax(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            </div>
          </SectionBody>
        )}

        {activeTab === "hotels" && (
          <SectionBody title="Hotels" subtitle="Add one or more stays. Rates resolve per night from the contracted seasons; add multiple stays for multi-city or multi-date trips.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Destination for this stay <span className="text-slate-400">(independent from Passengers — set this per stay for multi-city trips)</span>
                </label>
                <select className={inputClass} value={hotelCity} onChange={(e) => setHotelCity(e.target.value)}>
                  <option value="">Select destination…</option>
                  {cities.map((c) => (<option key={c.city} value={c.city}>{c.city} ({c.hotels})</option>))}
                </select>
              </div>
              <div />
              <select className={inputClass} value={hotelId} disabled={!hotelCity} onChange={(e) => setHotelId(e.target.value)}>
                <option value="">{hotelCity ? "Select hotel…" : "Pick a destination first"}</option>
                {hotels.map((h) => (<option key={h.id} value={h.id}>{h.name}{h.starRating ? ` · ${h.starRating}★` : ""}</option>))}
              </select>
              <select className={inputClass} value={roomId} disabled={!hotelId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">{hotelId ? "Select room…" : "Pick a hotel first"}</option>
                {rooms.map((r) => (<option key={r.id} value={r.id}>{r.name} · {r.mealPlan} · {r.maxPax}P</option>))}
              </select>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Check-in for this stay</label>
                <input type="date" className={inputClass} value={stayCheckIn} min={checkIn || undefined} max={checkOut || undefined} onChange={(e) => setStayCheckIn(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nights</label>
                <input type="number" min={1} className={inputClass} value={stayNights} onChange={(e) => setStayNights(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>

            {pricingBusy && <p className="mt-3 text-sm text-slate-500">Pricing stay…</p>}
            {pricing && (
              <div className="mt-4">
                {pricing.unavailableNights > 0 && (
                  <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {pricing.unavailableNights} of {pricing.nights} night(s) have no contracted rate for this room and are excluded.
                  </p>
                )}
                {avgNightlyOverBudget && (
                  <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    Average nightly rate per pax is above your budget — still addable, just flagging it.
                  </p>
                )}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr><th className="px-3 py-2">Night</th><th className="px-3 py-2">Season</th><th className="px-3 py-2 text-right">Rate</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricing.lines.map((l) => (
                        <tr key={l.date}>
                          <td className="px-3 py-1.5">{l.date}</td>
                          <td className="px-3 py-1.5 text-slate-500">{l.seasonCode ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">{l.rate != null ? formatMoney(l.rate, currency) : <span className="text-amber-600">n/a</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-medium">
                      <tr><td className="px-3 py-2" colSpan={2}>Stay subtotal</td><td className="px-3 py-2 text-right">{formatMoney(pricing.subtotal, currency)}</td></tr>
                    </tfoot>
                  </table>
                </div>
                <button onClick={addHotel} className="mt-3 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                  Add this stay to the itinerary
                </button>
              </div>
            )}

            {addedHotels.length > 0 && (
              <ul className="mt-4 space-y-2">
                {addedHotels.map((ah) => (
                  <li key={ah.uid} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span>{ah.pricing.hotel} — {ah.pricing.room} <span className="text-slate-400">· from {ah.checkIn}, {ah.pricing.nights} night(s)</span></span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">{formatMoney(ah.pricing.subtotal, ah.pricing.currency)}</span>
                      <button onClick={() => setAddedHotels((prev) => prev.filter((x) => x.uid !== ah.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "activities" && (
          <SectionBody title="Activities" subtitle="Add attractions and tours; assign each to a day and set pax.">
            <input className={inputClass} placeholder="Search activities (e.g. disney, peak, ocean park)…" value={activityQ} onChange={(e) => setActivityQ(e.target.value)} />
            <div className="mt-2 max-h-52 space-y-1 overflow-auto">
              {filteredActivities.map((a) => (
                <button key={a.id} onClick={() => addActivity(a)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span>{a.name} <span className="text-slate-400">· {a.service}</span></span>
                  <span className="text-slate-500">{a.adultRate != null ? formatMoney(a.adultRate, currency) : "—"}{a.childRate != null ? ` / ${formatMoney(a.childRate, currency)} ch` : ""}</span>
                </button>
              ))}
              {filteredActivities.length === 0 && <p className="px-1 py-2 text-sm text-slate-400">No activities match{budgetPerPax ? " your budget" : ""}.</p>}
            </div>

            {addedActivities.length > 0 && (
              <ul className="mt-3 space-y-2">
                {addedActivities.map((aa) => (
                  <li key={aa.uid} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex-1 min-w-[140px]">{aa.activity.name}</span>
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={aa.date} onChange={(e) => setAddedActivities((prev) => prev.map((x) => x.uid === aa.uid ? { ...x, date: e.target.value } : x))}>
                      {tripDates.map((d) => (<option key={d} value={d}>{d}</option>))}
                    </select>
                    <label className="text-xs text-slate-500">A</label>
                    <input type="number" min={0} className="w-14 rounded border border-slate-300 px-2 py-1 text-xs" value={aa.adults} onChange={(e) => setAddedActivities((prev) => prev.map((x) => x.uid === aa.uid ? { ...x, adults: Math.max(0, Number(e.target.value) || 0) } : x))} />
                    <label className="text-xs text-slate-500">C</label>
                    <input type="number" min={0} className="w-14 rounded border border-slate-300 px-2 py-1 text-xs" value={aa.children} onChange={(e) => setAddedActivities((prev) => prev.map((x) => x.uid === aa.uid ? { ...x, children: Math.max(0, Number(e.target.value) || 0) } : x))} />
                    <button onClick={() => setAddedActivities((prev) => prev.filter((x) => x.uid !== aa.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "transport" && (
          <SectionBody title="Transport" subtitle="Add point-to-point transfers; pick a vehicle size and assign a day.">
            <input className={inputClass} placeholder="Search transport (e.g. airport, disneyland)…" value={transferQ} onChange={(e) => setTransferQ(e.target.value)} />
            <div className="mt-2 max-h-52 space-y-1 overflow-auto">
              {filteredTransfers.map((t) => (
                <button key={t.id} onClick={() => addTransfer(t)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span>{t.fromLocation} → {t.toLocation} <span className="text-slate-400">· {t.service}</span></span>
                  <span className="text-slate-500">from {formatMoney(t.vehicles[0].netRate, currency)}</span>
                </button>
              ))}
              {filteredTransfers.length === 0 && <p className="px-1 py-2 text-sm text-slate-400">No transport options match{budgetPerPax ? " your budget" : ""}.</p>}
            </div>

            {addedTransfers.length > 0 && (
              <ul className="mt-3 space-y-2">
                {addedTransfers.map((at) => (
                  <li key={at.uid} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex-1 min-w-[140px]">{at.transfer.fromLocation} → {at.transfer.toLocation}</span>
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={at.date} onChange={(e) => setAddedTransfers((prev) => prev.map((x) => x.uid === at.uid ? { ...x, date: e.target.value } : x))}>
                      {tripDates.map((d) => (<option key={d} value={d}>{d}</option>))}
                    </select>
                    <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={at.vehicleTypeId} onChange={(e) => setAddedTransfers((prev) => prev.map((x) => x.uid === at.uid ? { ...x, vehicleTypeId: e.target.value } : x))}>
                      {at.transfer.vehicles.map((v) => (<option key={v.vehicleTypeId} value={v.vehicleTypeId}>{v.name} — {formatMoney(v.netRate, currency)}</option>))}
                    </select>
                    <input type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-1 text-xs" value={at.qty} onChange={(e) => setAddedTransfers((prev) => prev.map((x) => x.uid === at.uid ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                    <button onClick={() => setAddedTransfers((prev) => prev.filter((x) => x.uid !== at.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "guide" && (
          <SectionBody title="Guide" subtitle="Add a local guide for one or more days.">
            <input className={inputClass} placeholder="Search guides (e.g. Mandarin, Cantonese)…" value={guideQ} onChange={(e) => setGuideQ(e.target.value)} disabled={!city} />
            <div className="mt-2 max-h-52 space-y-1 overflow-auto">
              {!city && <p className="px-1 py-2 text-sm text-slate-400">Pick a destination first.</p>}
              {city && filteredGuides.map((g) => (
                <button key={g.id} onClick={() => addGuide(g)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span>{g.name} {g.language && <span className="text-slate-400">· {g.language}</span>}</span>
                  <span className="text-slate-500">{formatMoney(g.dailyRate, g.currency)} / day</span>
                </button>
              ))}
              {city && filteredGuides.length === 0 && <p className="px-1 py-2 text-sm text-slate-400">No guides on file for {city} yet{budgetPerPax ? " within budget" : ""}.</p>}
            </div>

            {addedGuides.length > 0 && (
              <ul className="mt-3 space-y-2">
                {addedGuides.map((ag) => (
                  <li key={ag.uid} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{ag.guide.name}</span>
                      <button onClick={() => setAddedGuides((prev) => prev.filter((x) => x.uid !== ag.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Start date</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ag.startDate} onChange={(e) => setAddedGuides((prev) => prev.map((x) => x.uid === ag.uid ? { ...x, startDate: e.target.value, endDate: x.endDate < e.target.value ? e.target.value : x.endDate } : x))}>
                          {tripDates.map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">End date</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ag.endDate} onChange={(e) => setAddedGuides((prev) => prev.map((x) => x.uid === ag.uid ? { ...x, endDate: e.target.value } : x))}>
                          {tripDates.filter((d) => d >= ag.startDate).map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Tour guide name (optional)</label>
                        <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" placeholder='Defaults to "Tour guide" if left blank' value={ag.guideName} onChange={(e) => setAddedGuides((prev) => prev.map((x) => x.uid === ag.uid ? { ...x, guideName: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Price ({ag.guide.currency})</label>
                        <input type="number" min={0} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ag.price} onChange={(e) => setAddedGuides((prev) => prev.map((x) => x.uid === ag.uid ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x))} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Comment (optional)</label>
                        <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" placeholder="Any notes for this guide booking…" value={ag.comment} onChange={(e) => setAddedGuides((prev) => prev.map((x) => x.uid === ag.uid ? { ...x, comment: e.target.value } : x))} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "otherServices" && (
          <SectionBody title="Other Services" subtitle="Anything catalog-based that isn't a hotel/transport/activity/guide — visa assistance, insurance, SIM cards, porterage.">
            <input className={inputClass} placeholder="Search other services…" value={serviceQ} onChange={(e) => setServiceQ(e.target.value)} disabled={!city} />
            <div className="mt-2 max-h-52 space-y-1 overflow-auto">
              {!city && <p className="px-1 py-2 text-sm text-slate-400">Pick a destination first.</p>}
              {city && filteredServices.map((s) => (
                <button key={s.id} onClick={() => addService(s)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span>{s.name} <span className="text-slate-400">· {s.unitLabel}</span></span>
                  <span className="text-slate-500">{formatMoney(s.rate, s.currency)}</span>
                </button>
              ))}
              {city && filteredServices.length === 0 && <p className="px-1 py-2 text-sm text-slate-400">No other services on file for {city} yet{budgetPerPax ? " within budget" : ""}.</p>}
            </div>

            {addedServices.length > 0 && (
              <ul className="mt-3 space-y-2">
                {addedServices.map((as) => (
                  <li key={as.uid} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{as.service.name}</span>
                      <button onClick={() => setAddedServices((prev) => prev.filter((x) => x.uid !== as.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Start date</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={as.startDate} onChange={(e) => setAddedServices((prev) => prev.map((x) => x.uid === as.uid ? { ...x, startDate: e.target.value, endDate: x.endDate < e.target.value ? e.target.value : x.endDate } : x))}>
                          {tripDates.map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">End date</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={as.endDate} onChange={(e) => setAddedServices((prev) => prev.map((x) => x.uid === as.uid ? { ...x, endDate: e.target.value } : x))}>
                          {tripDates.filter((d) => d >= as.startDate).map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Service details (optional)</label>
                        <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" placeholder="Any extra detail about this service…" value={as.details} onChange={(e) => setAddedServices((prev) => prev.map((x) => x.uid === as.uid ? { ...x, details: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Price ({as.service.currency})</label>
                        <input type="number" min={0} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={as.price} onChange={(e) => setAddedServices((prev) => prev.map((x) => x.uid === as.uid ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x))} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "additionalCharges" && (
          <SectionBody title="Additional Charges" subtitle="Ad-hoc one-off charges that aren't in any catalog — enter the details directly.">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputClass} placeholder="Title (e.g. Peak season surcharge)" value={chargeLabel} onChange={(e) => setChargeLabel(e.target.value)} />
              <input type="number" min={0} className={inputClass} placeholder="Price" value={chargeAmount || ""} onChange={(e) => setChargeAmount(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <button onClick={addCharge} className="mt-3 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Add</button>

            {addedCharges.length > 0 && (
              <ul className="mt-3 space-y-2">
                {addedCharges.map((ac) => (
                  <li key={ac.uid} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{ac.label}</span>
                      <button onClick={() => setAddedCharges((prev) => prev.filter((x) => x.uid !== ac.uid))} className="text-rose-500 hover:text-rose-700">✕</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Date</label>
                        <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ac.date} onChange={(e) => setAddedCharges((prev) => prev.map((x) => x.uid === ac.uid ? { ...x, date: e.target.value } : x))}>
                          {tripDates.map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Location (optional)</label>
                        <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ac.location} onChange={(e) => setAddedCharges((prev) => prev.map((x) => x.uid === ac.uid ? { ...x, location: e.target.value } : x))} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-0.5 block text-xs text-slate-500">Description (optional)</label>
                        <input className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ac.description} onChange={(e) => setAddedCharges((prev) => prev.map((x) => x.uid === ac.uid ? { ...x, description: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-xs text-slate-500">Price ({currency})</label>
                        <input type="number" min={0} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs" value={ac.amount} onChange={(e) => setAddedCharges((prev) => prev.map((x) => x.uid === ac.uid ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x))} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionBody>
        )}

        {activeTab === "inclusionExclusion" && (
          <SectionBody title="Inclusion / Exclusion" subtitle="Free-text lists shown on the quotation document.">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Inclusions</label>
                <TokenInput value={inclusions} onChange={setInclusions} placeholder="Type an inclusion and press Enter…" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Exclusions</label>
                <TokenInput value={exclusions} onChange={setExclusions} placeholder="Type an exclusion and press Enter…" />
              </div>
            </div>
          </SectionBody>
        )}

        {activeTab === "markup" && (
          <SectionBody title="Markup" subtitle="Applied once, on top of the net subtotal from every tab combined.">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={markupType === "PERCENT"} onChange={() => setMarkupType("PERCENT")} />
                Percentage (%)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={markupType === "FIXED"} onChange={() => setMarkupType("FIXED")} />
                Fixed amount ({currency})
              </label>
            </div>
            <input
              type="number" min={0} className={`${inputClass} mt-3 max-w-xs`}
              value={markupValue || ""}
              placeholder={markupType === "PERCENT" ? "e.g. 15" : "e.g. 500"}
              onChange={(e) => setMarkupValue(Math.max(0, Number(e.target.value) || 0))}
            />
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span>Subtotal (net)</span><span>{formatMoney(subtotal, currency)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Markup</span><span>+ {formatMoney(markupAmount, currency)}</span></div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold"><span>Total (sell price)</span><span>{formatMoney(total, currency)}</span></div>
            </div>
          </SectionBody>
        )}
      </div>

      {/* Summary rail — persistent across tabs */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-paper-200 bg-white shadow-sm shadow-brand-900/[0.04]">
          <div className="bg-brand-900 px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold text-white">Quote summary</h2>
          </div>
          <div className="p-5">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Add a hotel, activity, transport, guide, service, or charge to build the quote.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">{it.kind}</span>
                    {it.label}
                    {it.detail && <span className="block text-xs text-slate-400">{it.detail}</span>}
                  </span>
                  <span className="whitespace-nowrap font-medium">{formatMoney(it.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
            {markupAmount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Markup {markupType === "PERCENT" ? `(${markupValue}%)` : "(fixed)"}</span>
                <span>{formatMoney(markupAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-semibold">
              <span>Total</span>
              <span className="text-lg font-bold text-brand-700">{formatMoney(total, currency)}</span>
            </div>
          </div>
          <p className="mt-1 text-right text-xs text-slate-400">Net contracted rates · {currency}</p>

          {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button onClick={save} disabled={saving} className="mt-4 w-full rounded-md bg-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent-600 disabled:opacity-60">
            {saving ? "Saving…" : isEditMode ? "Save changes" : "Save quote"}
          </button>
          </div>
        </div>
      </aside>
      </div>
    </>
  );
}