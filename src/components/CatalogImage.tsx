"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CatalogImage({
  kind,
  id,
  imageUrl,
  fallback,
}: {
  kind: string;
  id: string;
  imageUrl: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const src = imageUrl || fallback;

  async function uploadFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("id", id);
      fd.append("file", file);
      const res = await fetch("/api/catalog/image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveUrl(next: string | null) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/catalog/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, url: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");
      setOpen(false);
      setUrl("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative block h-12 w-16 overflow-hidden rounded-md border border-slate-200"
        title="Change image"
      >
        <img src={src} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[10px] font-medium text-white group-hover:flex">
          Edit
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-14 z-20 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-slate-700">Set image</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="mb-2 w-full rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Uploading…" : "⤒ Upload a photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          <div className="flex items-center gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
              placeholder="or paste image URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !url.trim()}
              onClick={() => saveUrl(url)}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <div className="mt-2 flex justify-between">
            {imageUrl && (
              <button type="button" onClick={() => saveUrl(null)} className="text-xs text-rose-500 hover:underline">
                Remove
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-slate-400 hover:underline">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
