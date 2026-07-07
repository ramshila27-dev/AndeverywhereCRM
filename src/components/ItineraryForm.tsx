"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTEREST_OPTIONS,
  type GeneratedItinerary,
  type Pace,
  type TripInput,
} from "@/lib/types";
import ItineraryDays from "./ItineraryDays";

const emptyInput: TripInput = {
  destination: "",
  startDate: "",
  endDate: "",
  travelers: 2,
  budget: "",
  interests: [],
  pace: "balanced",
  notes: "",
};

export default function ItineraryForm() {
  const router = useRouter();
  const [input, setInput] = useState<TripInput>(emptyInput);
  const [result, setResult] = useState<GeneratedItinerary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TripInput>(key: K, value: TripInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function toggleInterest(interest: string) {
    setInput((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!input.destination || !input.startDate || !input.endDate) {
      setError("Destination and travel dates are required.");
      return;
    }
    if (new Date(input.endDate) < new Date(input.startDate)) {
      setError("End date must be on or after the start date.");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/itineraries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setResult(data as GeneratedItinerary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, itinerary: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      router.push(`/itineraries/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleGenerate}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Destination
            </label>
            <input
              className={inputClass}
              placeholder="e.g. Kyoto, Japan"
              value={input.destination}
              onChange={(e) => update("destination", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Start date
            </label>
            <input
              type="date"
              className={inputClass}
              value={input.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              End date
            </label>
            <input
              type="date"
              className={inputClass}
              value={input.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Travelers
            </label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={input.travelers}
              onChange={(e) =>
                update("travelers", Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Budget (optional)
            </label>
            <input
              className={inputClass}
              placeholder="e.g. $2000 total, or mid-range"
              value={input.budget}
              onChange={(e) => update("budget", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Pace
            </label>
            <div className="flex gap-2">
              {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update("pace", p)}
                  className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                    input.pace === p
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Interests
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    input.interests.includes(interest)
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Special requests (optional)
            </label>
            <textarea
              className={inputClass}
              rows={3}
              placeholder="Dietary needs, mobility considerations, must-see spots…"
              value={input.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={generating}
          className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {generating ? "Generating…" : "✨ Generate itinerary"}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">{result.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{result.summary}</p>
          </div>

          <ItineraryDays days={result.days} />

          {result.tips.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="mb-2 font-semibold text-slate-900">Travel tips</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                {result.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save itinerary"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
