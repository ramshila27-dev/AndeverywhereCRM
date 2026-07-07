"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QUERY_STATUS_LABEL,
  QUERY_STATUS_STYLE,
  QUERY_TRANSITIONS,
  type QueryStatusValue,
} from "@/lib/types";

export default function QueryLifecycle({
  id,
  status,
}: {
  id: string;
  status: QueryStatusValue;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<QueryStatusValue>(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = QUERY_TRANSITIONS[current] ?? [];

  async function move(to: QueryStatusValue) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/queries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update status.");
      setCurrent(to);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this query?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/queries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/queries");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Status</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${QUERY_STATUS_STYLE[current]}`}
        >
          {QUERY_STATUS_LABEL[current]}
        </span>
      </div>

      {next.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Move to
          </p>
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <button
                key={s}
                onClick={() => move(s)}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
              >
                {QUERY_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          This query has reached a final state.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          onClick={remove}
          disabled={busy}
          className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
        >
          Delete query
        </button>
      </div>
    </div>
  );
}
