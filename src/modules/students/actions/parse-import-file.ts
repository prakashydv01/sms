"use server";

import * as XLSX from "xlsx";

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Parses an uploaded .xlsx/.xls/.csv file into raw string rows.
 * Deliberately does NOT validate or map fields here - that happens in
 * later steps, against the same studentSchema the manual form uses.
 */
export async function parseImportFile(formData: FormData): Promise<
  | { success: true; sheet: ParsedSheet }
  | { success: false; error: string }
> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: "No file uploaded" };
  }

  const allowedExt = [".xlsx", ".xls", ".csv"];
  const hasAllowedExt = allowedExt.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  if (!hasAllowedExt) {
    return { success: false, error: "File must be .xlsx, .xls, or .csv" };
  }

  // Cap file size - a bad upload shouldn't be able to hang the server
  const MAX_BYTES = 5 * 1024 * 1024; // 5MB - plenty for thousands of student rows
  if (file.size > MAX_BYTES) {
    return { success: false, error: "File is too large (max 5MB)" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, error: "File has no sheets" };
    }
    const sheet = workbook.Sheets[firstSheetName];

    // defval: "" so blank cells become empty strings, not undefined/missing keys -
    // keeps every row shaped consistently for the validator downstream.
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false, // stringify everything (dates included) - we parse dates ourselves later
    });

    if (json.length === 0) {
      return { success: false, error: "File has no data rows" };
    }

    const headers = Object.keys(json[0]);
    const rows = json.map((row) => {
      const clean: Record<string, string> = {};
      for (const key of headers) {
        clean[key] = String(row[key] ?? "").trim();
      }
      return clean;
    });

    // Hard cap so one file can't try to import an absurd number of rows in one go
    const MAX_ROWS = 5000;
    if (rows.length > MAX_ROWS) {
      return {
        success: false,
        error: `File has ${rows.length} rows - please split into batches of ${MAX_ROWS} or fewer`,
      };
    }

    return { success: true, sheet: { headers, rows } };
  } catch {
    return { success: false, error: "Could not read this file - is it a valid Excel/CSV file?" };
  }
}
