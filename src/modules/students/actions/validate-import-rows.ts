"use server";

import { db } from "@/db";
import { studentSchema } from "../schemas/student.schema";
import { parseFlexibleDate } from "../lib/parse-date";
import { splitFullName } from "../lib/column-mapping";

export type ImportRowResult = {
  rowNumber: number; // 1-indexed, matches spreadsheet row (excluding header)
  status: "ok" | "warning" | "error";
  data: Record<string, string>; // resolved values, shown in the preview UI
  errors: Record<string, string>;
  warnings: Record<string, string>;
  extraFields?: Record<string, string>; // unmapped source columns, preserved verbatim
};

function normalizeGender(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (["m", "male", "boy"].includes(v)) return "male";
  if (["f", "female", "girl"].includes(v)) return "female";
  if (v === "other" || v === "o") return "other";
  return raw; // leave as-is, will fail schema validation with a clear message
}

/**
 * Takes raw parsed rows + the user's confirmed column mapping, resolves
 * class/section names to real IDs (creating unmapped classes on the fly
 * is deliberately NOT done here - unknown classes are surfaced as errors
 * so an admin doesn't accidentally create "Grade 5A" as a new class via
 * typo), splits a combined Full Name column if that's what was mapped,
 * captures any unmapped spreadsheet column into extraFields so it isn't
 * silently lost, then validates every row against the same studentSchema
 * the manual form uses.
 *
 * There is no admission-number/Student-ID handling here at all - IDs are
 * always auto-generated at commit time (see generateStudentId), so
 * there's nothing to map, validate, or de-duplicate for it during import.
 */
export async function validateImportRows(
  schoolId: string,
  rawRows: Record<string, string>[],
  mapping: Record<string, string> // targetFieldKey -> sourceHeader
): Promise<{ results: ImportRowResult[]; summary: { ok: number; warning: number; error: number } }> {
  const classes = await db.query.classes.findMany({
    where: (c, { eq }) => eq(c.schoolId, schoolId),
    with: { sections: true },
  });

  const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

  // Any source header not consumed by a mapped target field gets carried
  // through as extraFields - this is what makes "father name", "blood
  // group", "previous school", or anything else the schema doesn't
  // explicitly model survive the import instead of being dropped.
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
  const unmappedHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]).filter((h) => !mappedHeaders.has(h)) : [];

  const results: ImportRowResult[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    const get = (key: string) => (mapping[key] ? raw[mapping[key]] ?? "" : "");

    const className = get("className").trim();
    const sectionName = get("sectionName").trim();
    const matchedClass = classByName.get(className.toLowerCase());
    if (className && !matchedClass) {
      errors.className = `Class "${className}" doesn't exist in the system`;
    }
    let sectionId = "";
    if (matchedClass && sectionName) {
      const matchedSection = matchedClass.sections.find(
        (s) => s.name.trim().toLowerCase() === sectionName.toLowerCase()
      );
      if (matchedSection) {
        sectionId = matchedSection.id;
      } else {
        warnings.sectionName = `Section "${sectionName}" not found for ${className} - will import without a section`;
      }
    }

    const dobRaw = get("dateOfBirth");
    const dob = parseFlexibleDate(dobRaw);
    if (dobRaw && !dob) errors.dateOfBirth = `Could not parse date "${dobRaw}"`;

    const admissionDateRaw = get("admissionDate");
    const admissionDate = parseFlexibleDate(admissionDateRaw);
    if (admissionDateRaw && !admissionDate) errors.admissionDate = `Could not parse date "${admissionDateRaw}"`;

    // Name resolution: either a mapped Full Name column (split here) or
    // separately mapped First/Last Name columns - whichever the admin's
    // chosen mapping actually populated.
    let firstName = get("firstName").trim();
    let lastName = get("lastName").trim();
    const fullNameRaw = get("fullName").trim();
    if (fullNameRaw && !firstName && !lastName) {
      const split = splitFullName(fullNameRaw);
      firstName = split.firstName;
      lastName = split.lastName;
      if (!lastName) {
        warnings.lastName = `Only one word in "${fullNameRaw}" - used as first name, last name left blank`;
      }
    }
    if (!firstName && !lastName && !fullNameRaw) {
      errors.firstName = "No name column mapped";
    }

    const candidate = {
      firstName,
      lastName,
      dateOfBirth: dob ?? "",
      gender: normalizeGender(get("gender")),
      classId: matchedClass?.id ?? "",
      sectionId,
      guardianName: get("guardianName").trim(),
      guardianPhone: get("guardianPhone").trim(),
      guardianEmail: get("guardianEmail").trim(),
      fatherName: get("fatherName").trim(),
      motherName: get("motherName").trim(),
      address: get("address").trim(),
      admissionDate: admissionDate ?? "",
    };

    // Only run schema validation on fields that resolved cleanly - a bad
    // class name already produced a clearer error above than Zod would give.
    if (candidate.classId) {
      const parsed = studentSchema.safeParse(candidate);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path.join(".") || "form";
          if (!errors[field]) errors[field] = issue.message;
        }
      }
    }

    const extraFields: Record<string, string> = {};
    for (const header of unmappedHeaders) {
      const value = raw[header];
      if (value && value.trim() !== "") extraFields[header] = value.trim();
    }

    const status: ImportRowResult["status"] =
      Object.keys(errors).length > 0 ? "error" : Object.keys(warnings).length > 0 ? "warning" : "ok";

    results.push({
      rowNumber,
      status,
      data: candidate,
      errors,
      warnings,
      extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
    });
  });

  const summary = {
    ok: results.filter((r) => r.status === "ok").length,
    warning: results.filter((r) => r.status === "warning").length,
    error: results.filter((r) => r.status === "error").length,
  };

  return { results, summary };
}
