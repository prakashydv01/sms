"use client";

import { useState } from "react";
import { adToBs, bsToAd, BS_MONTH_NAMES } from "@/lib/nepali-date";

/**
 * A date field usable by AD-first or BS-first schools alike. Internally
 * the value is always an AD ISO string ("YYYY-MM-DD") - that's what's
 * stored in Postgres and what every date calculation in the app expects.
 * The BS mode is a different way to PRODUCE that same AD string, not a
 * parallel storage format - so nothing downstream (validation, invoice
 * generation, reports) needs to know or care which mode was used to
 * enter a given date.
 */
export function DualDateField({
  label,
  name,
  value,
  onChange,
  error,
  required,
}: {
  label: string;
  name: string;
  value: string; // always AD ISO "YYYY-MM-DD"
  onChange: (adIsoDate: string) => void;
  error?: string;
  required?: boolean;
}) {
  const [mode, setMode] = useState<"ad" | "bs">("ad");
  const bsPreview = value ? adToBs(value) : null;

  // BS input mode keeps its own year/month/day so partial entry (e.g.
  // year typed, month not yet picked) doesn't try to convert prematurely.
  const [bsYear, setBsYear] = useState(bsPreview ? String(bsPreview.year) : "");
  const [bsMonth, setBsMonth] = useState(bsPreview ? String(bsPreview.month) : "");
  const [bsDay, setBsDay] = useState(bsPreview ? String(bsPreview.day) : "");

  function handleBsChange(y: string, m: string, d: string) {
    setBsYear(y);
    setBsMonth(m);
    setBsDay(d);
    if (y && m && d) {
      const ad = bsToAd(Number(y), Number(m), Number(d));
      if (ad) onChange(ad);
    }
  }

  function switchToBs() {
    setMode("bs");
    if (bsPreview) {
      setBsYear(String(bsPreview.year));
      setBsMonth(String(bsPreview.month));
      setBsDay(String(bsPreview.day));
    }
  }

  return (
    <div className="block text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        <div className="flex rounded border border-slate-200 text-[10px]">
          <button
            type="button"
            onClick={() => setMode("ad")}
            className={`px-1.5 py-0.5 ${mode === "ad" ? "bg-slate-900 text-white" : "text-slate-500"}`}
          >
            AD
          </button>
          <button
            type="button"
            onClick={switchToBs}
            className={`px-1.5 py-0.5 ${mode === "bs" ? "bg-slate-900 text-white" : "text-slate-500"}`}
          >
            BS
          </button>
        </div>
      </div>

      {mode === "ad" ? (
        <>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 ${
              error ? "border-red-300 focus:ring-red-100" : "border-slate-300 focus:ring-slate-100"
            }`}
          />
          {bsPreview && (
            <span className="mt-1 block text-xs text-slate-400">
              ≈ BS {bsPreview.day} {BS_MONTH_NAMES[bsPreview.month - 1]} {bsPreview.year}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <input
              type="number"
              placeholder="Year"
              value={bsYear}
              onChange={(e) => handleBsChange(e.target.value, bsMonth, bsDay)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <select
              value={bsMonth}
              onChange={(e) => handleBsChange(bsYear, e.target.value, bsDay)}
              className="w-full rounded-md border border-slate-300 px-1 py-1.5 text-sm"
            >
              <option value="">Month</option>
              {BS_MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Day"
              value={bsDay}
              onChange={(e) => handleBsChange(bsYear, bsMonth, e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {value && (
            <span className="mt-1 block text-xs text-slate-400">≈ AD {value}</span>
          )}
        </>
      )}
      {/* Hidden field so this still works inside a plain <form action={...}> that reads FormData by name */}
      <input type="hidden" name={name} value={value} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}
