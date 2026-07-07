"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentInput } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

interface AgentRecord extends AgentInput {
  id: string;
}

export default function AgentSearch({
  value,
  onChange,
}: {
  value: AgentInput;
  onChange: (agent: AgentInput) => void;
}) {
  const [searchTerm, setSearchTerm] = useState(
    value.companyName || value.agentName || "",
  );
  const [results, setResults] = useState<AgentRecord[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search-as-you-type against the agent database.
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/agents?search=${encodeURIComponent(searchTerm)}`)
        .then((r) => r.json())
        .then((d: AgentRecord[]) => setResults(d))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Close the suggestion dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectAgent(agent: AgentRecord) {
    setSearchTerm(agent.companyName);
    setOpen(false);
    onChange(agent);
  }

  function patch(fields: Partial<AgentInput>) {
    // Editing any field manually after a selection means this is either a
    // correction or a brand-new agent — clear the linked id so save creates
    // a fresh/updated record instead of silently overwriting a different one.
    onChange({ ...value, ...fields, id: undefined });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">
        Agent Details{" "}
        <span className="font-normal text-slate-400">
          — search an existing agent or enter a new one
        </span>
      </p>

      <div ref={boxRef} className="relative mb-4">
        <label className={labelClass}>Search Agent (company or agent name, mobile)</label>
        <input
          className={inputClass}
          placeholder="Type to search saved agents..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
            patch({ companyName: e.target.value });
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {open && results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => selectAgent(a)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
                >
                  <span className="font-medium text-slate-800">{a.companyName}</span>{" "}
                  <span className="text-slate-500">— {a.agentName}</span>
                  <span className="block text-xs text-slate-400">{a.mobile}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Agent Company Name</label>
          <input
            className={inputClass}
            value={value.companyName}
            onChange={(e) => patch({ companyName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Agent Name</label>
          <input
            className={inputClass}
            value={value.agentName}
            onChange={(e) => patch({ agentName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Mobile Number</label>
          <input
            className={inputClass}
            value={value.mobile}
            onChange={(e) => patch({ mobile: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            Email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            className={inputClass}
            value={value.email || ""}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>
            Address <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={value.address || ""}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            City <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={value.city || ""}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            Pin Code <span className="text-slate-400">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={value.pincode || ""}
            onChange={(e) => patch({ pincode: e.target.value })}
          />
        </div>
      </div>
      {value.id && (
        <p className="mt-2 text-xs text-emerald-600">
          ✓ Using saved agent — details auto-filled from the database.
        </p>
      )}
    </div>
  );
}
