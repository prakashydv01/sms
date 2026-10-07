/**
 * Real school spreadsheets mix date formats constantly: ISO, DD/MM/YYYY,
 * MM/DD/YYYY, and Excel's own serial-number dates when cellDates parsing
 * doesn't catch it. This tries the common cases and returns YYYY-MM-DD
 * (what our date columns expect) or null if nothing matches.
 */
export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Already ISO (2026-04-01)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidDate(value) ? value : null;
  }

  // Excel serial date number leaking through as a plain number string
  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 60000) {
      // Excel epoch: day 0 = 1899-12-30
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(epoch.getTime() + serial * 86400000);
      return date.toISOString().slice(0, 10);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (assume day-first, most common outside the US)
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d);
    const month = Number(m);
    // If the first number can't be a day (>31), or is clearly a month-first
    // pattern (day part > 12 but month part <= 12), we still assume D/M/Y
    // unless the "day" slot is > 31, in which case swap.
    const iso = day > 31 ? null : `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso && isValidDate(iso)) return iso;
  }

  // Fallback to whatever Date.parse can figure out
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }

  return null;
}

function isValidDate(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}
