"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL: Record<string, string> = {
  hotels: "Hotel Prices",
  transfers: "Transportation Prices",
  activities: "Travel Activity Prices",
};

export default function UploadRatesForm({ kind }: { kind: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [currency, setCurrency] = useState("HKD");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  async function upload() {
    if (!files.length) {
      setError("Please choose an .xlsx / .xls file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const totals: Record<string, number> = {};
      for (const file of files) {
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("file", file);
        const res = await fetch("/api/catalog/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        for (const [k, v] of Object.entries(data.result as Record<string, number>)) {
          totals[k] = (totals[k] || 0) + (v as number);
        }
      }
      setResult(totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["HKD", "INR", "USD", "AED"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Select {kind === "hotels" ? "file(s)" : "a file"}
          </label>
          <div className="flex items-center gap-2 rounded-md border border-slate-300 p-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Choose File{kind === "hotels" ? "s" : ""}
            </button>
            <span className="truncate text-sm text-slate-500">
              {files.length ? files.map((f) => f.name).join(", ") : "No file selected"}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            multiple={kind === "hotels"}
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <p className="mt-1 text-xs text-slate-400">
            Prices are read from the sheet as provided ({currency}).
          </p>
        </div>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {result && (
        <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <p className="font-medium">Import complete ✓</p>
          <p className="mt-1">
            {Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={upload}
          disabled={busy}
          className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Uploading…" : `Upload ${KIND_LABEL[kind]} XLS`}
        </button>
        {result ? (
          <button
            onClick={() => router.push(`/catalog?tab=${kind}`)}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            View {KIND_LABEL[kind].replace(" Prices", "")} →
          </button>
        ) : (
          <button onClick={() => router.push(`/catalog?tab=${kind}`)} className="text-sm text-slate-600 hover:text-slate-800">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
