"use client";

import { useEffect, useState } from "react";

interface CurrencyRow {
  currency: string;
  symbol: string;
  name: string;
  rateFromBase: number;
  isBase: boolean;
  updatedAt: string;
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";

const emptyForm = { currency: "", symbol: "", name: "", rateFromBase: "" };

export default function CurrencyManager() {
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((d: CurrencyRow[]) => setRows(d))
      .catch(() => setError("Could not load currencies."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setEditingCurrency(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: CurrencyRow) {
    setEditingCurrency(row.currency);
    setForm({ currency: row.currency, symbol: row.symbol, name: row.name, rateFromBase: String(row.rateFromBase) });
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    setError(null);
    if (!form.currency.trim() || !form.name.trim() || !form.rateFromBase) {
      setError("Currency code, name, and rate are all required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: form.currency.trim().toUpperCase(),
          symbol: form.symbol.trim() || form.currency.trim().toUpperCase(),
          name: form.name.trim(),
          rateFromBase: Number(form.rateFromBase),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(currency: string) {
    if (!confirm(`Remove ${currency} from the currency list?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/exchange-rates/${currency}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed.");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-slate-500 px-5 py-3 text-white">
        <h1 className="text-lg font-semibold">Currency Management</h1>
        <button
          onClick={openAdd}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-600"
        >
          + Add New Currency
        </button>
      </div>

      {error && !formOpen && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {formOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            {editingCurrency ? `Edit ${editingCurrency}` : "Add New Currency"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
              <input
                className={inputClass}
                placeholder="EUR"
                maxLength={6}
                value={form.currency}
                disabled={!!editingCurrency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Symbol</label>
              <input
                className={inputClass}
                placeholder="€"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
              <input
                className={inputClass}
                placeholder="Euro"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Rate (1 USD = ?)</label>
              <input
                type="number"
                step="0.0001"
                min={0}
                className={inputClass}
                placeholder="0.8600"
                value={form.rateFromBase}
                onChange={(e) => setForm((f) => ({ ...f, rateFromBase: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">All Currencies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Symbol</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Rate (1 USD = ?)</th>
                <th className="px-4 py-2">Base</th>
                <th className="px-4 py-2">Last Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No currencies yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.currency} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{r.symbol}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{r.currency}</td>
                  <td className="px-4 py-3 text-slate-700">{r.name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.rateFromBase.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    {r.isBase ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={r.isBase}
                        className="rounded-md bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      {!r.isBase && (
                        <button
                          onClick={() => remove(r.currency)}
                          disabled={busy}
                          className="rounded-md bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        USD is the fixed base currency (rate always 1) since every conversion pivots through it. Rates
        are entered manually here — there is no live/paid FX feed — so keep them updated as needed.
      </p>
    </div>
  );
}
