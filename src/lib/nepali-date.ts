import NepaliDate from "nepali-date-converter";

export const BS_MONTH_NAMES = [
  "Baishakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

/**
 * Converts an AD date (ISO "YYYY-MM-DD") to its BS equivalent.
 * Returns null for an unparseable input rather than throwing, since this
 * is often called live as someone types/picks a date.
 */
export function adToBs(adIsoDate: string): { year: number; month: number; day: number } | null {
  if (!adIsoDate || Number.isNaN(Date.parse(adIsoDate))) return null;
  const [y, m, d] = adIsoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  try {
    const nd = new NepaliDate(new Date(y, m - 1, d));
    // nepali-date-converter's getters are 0-indexed for month, matching JS Date convention
    return { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() };
  } catch {
    return null;
  }
}

/** Converts a BS date (year, 1-indexed month, day) to an AD ISO "YYYY-MM-DD" string. */
export function bsToAd(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  try {
    const nd = new NepaliDate(year, month - 1, day);
    const jsDate = nd.toJsDate();
    const y = jsDate.getFullYear();
    const m = String(jsDate.getMonth() + 1).padStart(2, "0");
    const d = String(jsDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return null;
  }
}

/** Human-readable BS string, e.g. "19 Chaitra 2082", for display alongside an AD date. */
export function formatBs(adIsoDate: string): string | null {
  const bs = adToBs(adIsoDate);
  if (!bs) return null;
  return `${bs.day} ${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
}
