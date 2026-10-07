/**
 * Defines every field we can import for a student, plus the header names
 * schools commonly use for each - so we can auto-suggest a mapping instead
 * of forcing the user to map every column by hand every time.
 *
 * Note: className/sectionName here are TEXT, not IDs - unlike the manual
 * form, an imported file only has "Grade 5" as a string. Resolving that to
 * an actual classId happens in validate-import-rows.ts, after mapping.
 *
 * There is no "Admission Number" / "Student ID" target field - Student
 * IDs are always auto-generated (see generateStudentId), never imported
 * from a spreadsheet column, so admins never have to worry about
 * colliding with or preserving whatever numbering an old system used.
 *
 * fullName exists as an ALTERNATIVE to firstName+lastName, not an addition
 * - the import wizard lets the admin pick "one full name column" or
 * "separate first/last columns" and only shows the relevant field(s).
 * Which one ends up mapped is what validate-import-rows.ts uses to decide
 * whether to split a combined name.
 */
export type TargetField = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
};

export const IMPORT_TARGET_FIELDS: TargetField[] = [
  { key: "fullName", label: "Full Name", required: false, aliases: ["full name", "name", "student name", "child name"] },
  { key: "firstName", label: "First Name", required: false, aliases: ["first name", "firstname", "given name", "student first name"] },
  { key: "lastName", label: "Last Name", required: false, aliases: ["last name", "lastname", "surname", "family name", "student last name"] },
  { key: "dateOfBirth", label: "Date of Birth", required: true, aliases: ["date of birth", "dob", "birth date", "birthday"] },
  { key: "gender", label: "Gender", required: true, aliases: ["gender", "sex"] },
  { key: "className", label: "Class", required: true, aliases: ["class", "grade", "class name", "standard"] },
  { key: "sectionName", label: "Section", required: false, aliases: ["section", "section name", "division"] },
  { key: "guardianName", label: "Guardian Name", required: true, aliases: ["guardian name", "parent name", "guardian", "primary contact name"] },
  { key: "guardianPhone", label: "Guardian Phone", required: true, aliases: ["guardian phone", "phone", "contact number", "mobile", "phone number"] },
  { key: "guardianEmail", label: "Guardian Email", required: false, aliases: ["guardian email", "email", "email address"] },
  { key: "fatherName", label: "Father's Name", required: false, aliases: ["father name", "father's name", "dad name", "father"] },
  { key: "motherName", label: "Mother's Name", required: false, aliases: ["mother name", "mother's name", "mom name", "mother"] },
  { key: "address", label: "Address", required: false, aliases: ["address", "home address"] },
  { key: "admissionDate", label: "Admission Date", required: true, aliases: ["admission date", "date of admission", "joining date"] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Suggests a mapping of { targetFieldKey: sourceHeader } by comparing
 * normalized header text against known aliases. Exact/substring match only -
 * intentionally simple rather than a full similarity algorithm, since
 * mismatches are always human-correctable in the mapping UI anyway.
 *
 * nameMode controls whether firstName+lastName or fullName gets
 * auto-detection attention - both are checked either way, but the wizard
 * only shows the relevant one(s) based on the admin's chosen mode.
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalize(h) }));

  for (const field of IMPORT_TARGET_FIELDS) {
    const aliasSet = [field.label, ...field.aliases].map(normalize);
    const match = normalizedHeaders.find((h) => aliasSet.includes(h.normalized));
    if (match) {
      mapping[field.key] = match.original;
      continue;
    }
    // Fallback: substring match (e.g. header "Student's First Name" contains "first name")
    const partial = normalizedHeaders.find((h) =>
      aliasSet.some((a) => h.normalized.includes(a))
    );
    if (partial) mapping[field.key] = partial.original;
  }

  return mapping;
}

/**
 * Splits a single "Full Name" value into first/last name. Heuristic: the
 * first whitespace-separated token is the first name, everything after
 * it is the last name. This is deliberately simple and Western-name-
 * biased - it's shown back to the admin in the preview step precisely
 * because no automatic split is right for every naming convention, and
 * a visible, reviewable result beats a silently-wrong guess.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
