"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_OPTIONS, type ItineraryDay } from "@/lib/types";
import ItineraryDays from "./ItineraryDays";

export interface ItineraryViewProps {
  id: string;
  title: string;
  destination: string;
  dateRange: string;
  travelers: number;
  status: string;
  summary: string | null;
  interests: string[];
  notes: string | null;
  days: ItineraryDay[];
  tips: string[];
}

export default function ItineraryView(props: ItineraryViewProps) {
  const router = useRouter();
  const [status, setStatus] = useState(props.status);
  const [busy, setBusy] = useState(false);

  async function changeStatus(next: string) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/itineraries/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setStatus(prev); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this itinerary? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/itineraries/${props.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{props.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {props.destination} · {props.dateRange} · {props.travelers}{" "}
              traveler{props.travelers === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Status</label>
            <select
              value={status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm capitalize focus:border-brand-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {props.summary && (
          <p className="mt-4 text-sm text-slate-600">{props.summary}</p>
        )}

        {props.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {props.interests.map((i) => (
              <span
                key={i}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {i}
              </span>
            ))}
          </div>
        )}

        {props.notes && (
          <p className="mt-3 text-sm text-slate-500">
            <span className="font-medium text-slate-700">Notes:</span>{" "}
            {props.notes}
          </p>
        )}
      </div>

      <ItineraryDays days={props.days} />

      {props.tips.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 font-semibold text-slate-900">Travel tips</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            {props.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleDelete}
          disabled={busy}
          className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
        >
          Delete itinerary
        </button>
      </div>
    </div>
  );
}
