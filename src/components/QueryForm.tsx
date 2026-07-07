"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TokenInput from "./TokenInput";
import AgentSearch from "./AgentSearch";
import { PHONE_CODES, type Phone, type AgentInput, type QueryInput } from "@/lib/types";
import { COUNTRIES } from "@/lib/countries";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const SOURCES = ["B2B", "Website", "Referral", "Walk-in", "Social Media", "Repeat Client"];

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 border-b border-slate-100 py-8 md:grid-cols-[260px_1fr]">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <span>{icon}</span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export interface QueryEditInitial {
  id: string;
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

export default function QueryForm({ initial }: { initial?: QueryEditInitial }) {
  const router = useRouter();
  const isEditMode = !!initial?.id;

  const [source, setSource] = useState(initial?.source ?? "");
  const [referenceId, setReferenceId] = useState(initial?.referenceId ?? "");
  const [salesTeam, setSalesTeam] = useState(initial?.salesTeam ?? "");
  const [agent, setAgent] = useState<AgentInput>(
    initial?.agent ?? {
      companyName: "",
      agentName: "",
      mobile: "",
      email: "",
      address: "",
      city: "",
      pincode: "",
    },
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  const [destinations, setDestinations] = useState<string[]>(initial?.destinations ?? []);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [nights, setNights] = useState<number | "">(initial?.nights ?? "");
  const [adults, setAdults] = useState<number | "">(initial?.adults ?? "");
  const [childAges, setChildAges] = useState<number[]>(initial?.childAges ?? []);
  const [infants, setInfants] = useState<number | "">(initial?.infants ?? "");
  const [totalFoc, setTotalFoc] = useState<number | "">(initial?.totalFoc ?? "");

  const [salutation, setSalutation] = useState(initial?.salutation ?? "");
  const [guestName, setGuestName] = useState(initial?.guestName ?? "");
  const [phones, setPhones] = useState<Phone[]>(initial?.phones ?? [{ code: "91-IN", number: "" }]);
  const [showEmail, setShowEmail] = useState(!!initial?.email);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [showLocation, setShowLocation] = useState(!!initial?.location);
  const [location, setLocation] = useState(initial?.location ?? "");

  const [comments, setComments] = useState(initial?.comments ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salesTeamOptions, setSalesTeamOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/sales-team")
      .then((r) => r.json())
      .then((d: { name: string }[]) => setSalesTeamOptions(d.map((p) => p.name)))
      .catch(() => {});
  }, []);

  function setPhone(i: number, patch: Partial<Phone>) {
    setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function save() {
    setError(null);
    setSaving(true);
    const payload: QueryInput = {
      source,
      referenceId,
      salesTeam,
      agent:
        agent.companyName.trim() && agent.agentName.trim() && agent.mobile.trim()
          ? agent
          : undefined,
      tags,
      destinations,
      startDate: startDate || undefined,
      nights: nights === "" ? 1 : nights,
      adults: adults === "" ? 1 : adults,
      childAges,
      infants: infants === "" ? 0 : infants,
      totalFoc: totalFoc === "" ? 0 : totalFoc,
      salutation,
      guestName,
      phones: phones.filter((p) => p.number.trim()),
      email: showEmail ? email : undefined,
      location: showLocation ? location : undefined,
      comments,
    };
    try {
      const res = await fetch(isEditMode ? `/api/queries/${initial!.id}` : "/api/queries", {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      router.push(`/queries/${isEditMode ? initial!.id : data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6">
      {/* Query Source */}
      <Row
        icon="🗂️"
        title="Query Source"
        desc="Please specify the query source, e.g., whether it came via B2B or from another source."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Query Source</label>
            <input
              className={inputClass}
              list="sources"
              placeholder="Type to search..."
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <datalist id="sources">
              {SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>
              Reference ID <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className={inputClass}
              placeholder="1231231"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              A custom id for your reference regarding the query
            </p>
          </div>
          <div>
            <label className={labelClass}>Sales Team</label>
            <select className={inputClass} value={salesTeam} onChange={(e) => setSalesTeam(e.target.value)}>
              <option value="">Select sales person…</option>
              {salesTeamOptions.map((p) => (<option key={p} value={p}>{p}</option>))}
              {salesTeam && !salesTeamOptions.includes(salesTeam) && (
                <option value={salesTeam}>{salesTeam} (no longer active)</option>
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Tags <span className="text-slate-400">(optional)</span>
            </label>
            <TokenInput
              value={tags}
              onChange={setTags}
              placeholder="Search & select tag(s)..."
            />
          </div>
          <div className="sm:col-span-2">
            <AgentSearch value={agent} onChange={setAgent} />
          </div>
        </div>
      </Row>

      {/* Destination and Duration */}
      <Row
        icon="📍"
        title="Destination and Duration"
        desc="Please provide basic details such as destination, duration etc. along with number of adults and children with ages."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={labelClass}>Destinations</label>
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v && !destinations.includes(v)) setDestinations([...destinations, v]);
              }}
            >
              <option value="">Select destination…</option>
              {COUNTRIES.filter((c) => !destinations.includes(c)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {destinations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {destinations.map((d) => (
                  <span key={d} className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    {d}
                    <button
                      type="button"
                      onClick={() => setDestinations(destinations.filter((x) => x !== d))}
                      className="text-brand-400 hover:text-brand-700"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>No. of Nights</label>
            <input
              type="number"
              min={1}
              className={`${inputClass} no-spinner`}
              value={nights}
              onChange={(e) => setNights(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
            <p className="mt-1 text-xs text-slate-500">
              {nights === "" ? "Enter nights to see days" : `${nights} Night${nights > 1 ? "s" : ""}, ${nights + 1} Days`}
            </p>
          </div>

          <div>
            <label className={labelClass}>No. of Adults</label>
            <input
              type="number"
              min={1}
              className={`${inputClass} no-spinner`}
              value={adults}
              onChange={(e) => setAdults(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className={labelClass}>Add Children and their Ages</label>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Number of children</span>
              <input
                type="number"
                min={0}
                max={10}
                className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm no-spinner"
                value={childAges.length}
                onChange={(e) => {
                  const count = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                  setChildAges((prev) =>
                    count > prev.length
                      ? [...prev, ...Array(count - prev.length).fill(5)]
                      : prev.slice(0, count),
                  );
                }}
              />
            </div>
            {childAges.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-full text-xs text-slate-500">Age of each child (optional to adjust):</span>
                {childAges.map((age, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={17}
                      className="w-16 rounded-md border border-slate-300 px-2 py-2 text-sm no-spinner"
                      value={age}
                      onChange={(e) =>
                        setChildAges((prev) =>
                          prev.map((a, idx) =>
                            idx === i ? Math.max(0, Number(e.target.value) || 0) : a,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setChildAges((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-rose-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>No. of Infants</label>
            <input
              type="number"
              min={0}
              max={10}
              className={`${inputClass} no-spinner`}
              value={infants}
              onChange={(e) => setInfants(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
            <p className="mt-1 text-xs text-slate-500">Under 2 years — no individual ages tracked.</p>
          </div>
          <div>
            <label className={labelClass}>
              Total FOC{" "}
              <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">
                NEW
              </span>
            </label>
            <input
              type="number"
              min={0}
              className={`${inputClass} no-spinner`}
              value={totalFoc}
              onChange={(e) => setTotalFoc(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>
      </Row>

      {/* Guest Details */}
      <Row
        icon="🧾"
        title="Guest Details"
        desc="Please provide name and phone number(s)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Salutation</label>
            <input
              className={inputClass}
              list="salutations"
              placeholder="e.g. Mr."
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
            />
            <datalist id="salutations">
              {["Mr.", "Mrs.", "Ms.", "Dr."].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              placeholder="Anoop Rai"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Phone Number(s)</label>
            <div className="space-y-2">
              {phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                    value={p.code}
                    onChange={(e) => setPhone(i, { code: e.target.value })}
                  >
                    {PHONE_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. 9779212233"
                    value={p.number}
                    onChange={(e) => setPhone(i, { number: e.target.value })}
                  />
                  {i === phones.length - 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setPhones((prev) => [...prev, { code: "91-IN", number: "" }])
                        }
                        className="grid h-9 w-9 place-items-center rounded-md border border-brand-300 text-brand-600 hover:bg-brand-50"
                        title="Add phone"
                      >
                        ⊕
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmail((v) => !v)}
                        className={`grid h-9 w-9 place-items-center rounded-md border ${showEmail ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-300 text-slate-500"} hover:bg-slate-50`}
                        title="Add email"
                      >
                        ✉
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLocation((v) => !v)}
                        className={`grid h-9 w-9 place-items-center rounded-md border ${showLocation ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-300 text-slate-500"} hover:bg-slate-50`}
                        title="Add location"
                      >
                        📍
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setPhones((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-rose-500 hover:bg-rose-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {showEmail && (
                <input
                  type="email"
                  className={inputClass}
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
              {showLocation && (
                <input
                  className={inputClass}
                  placeholder="City / address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      </Row>

      {/* Comments */}
      <Row
        icon="💬"
        title="Comments or Notes"
        desc="Please provide any comments or notes regarding this query which may be useful for sales process."
      >
        <div>
          <label className={labelClass}>
            Comments <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            className={inputClass}
            rows={4}
            placeholder="Only 5 star hotels"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
      </Row>

      {error && (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-center gap-4 py-6">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Details"}
        </button>
        <button
          onClick={() => router.push("/queries")}
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
