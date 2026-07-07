"use client";

import { useState } from "react";

// A lightweight chips input: type and press Enter (or comma) to add a token.
export default function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      onChange([...value, t]);
    }
    setText("");
  }

  const matches = text
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(text.toLowerCase()) &&
            !value.some((v) => v.toLowerCase() === s.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="text-brand-400 hover:text-brand-700"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 border-0 p-1 text-sm outline-none"
          placeholder={value.length ? "" : placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
