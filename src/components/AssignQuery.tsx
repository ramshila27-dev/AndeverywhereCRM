"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssignQuery({
  queryId,
  current,
  employees,
}: {
  queryId: string;
  current: string[]; // ids of currently assigned people
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/queries/${queryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not assign.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 font-semibold text-slate-900">Assignment</h2>
      <p className="mb-2 text-xs text-slate-500">
        Everyone checked below sees this query in their portal. You can assign it to more than
        one person.
      </p>
      <div className="max-h-56 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
        {employees.length === 0 && (
          <p className="px-1 py-2 text-xs text-slate-400">No employees available.</p>
        )}
        {employees.map((e) => (
          <label
            key={e.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(e.id)}
              onChange={() => toggle(e.id)}
              className="rounded border-slate-300"
            />
            {e.name}
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={busy}
        className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save Assignment"}
      </button>
      {saved && <p className="mt-2 text-xs text-emerald-600">Saved ✓</p>}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
