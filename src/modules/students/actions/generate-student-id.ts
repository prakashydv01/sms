import { db } from "@/db";
import { studentIdSequences } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Derives a short prefix from a school's name for use in generated
 * Student IDs - e.g. "Green Valley School" -> "GVS". Takes the first
 * letter of each significant word (skipping tiny connector words like
 * "of"/"the"/"and" so they don't pollute a 4+ letter school name into an
 * unwieldy prefix), capped at 4 letters. Falls back to the first 3
 * letters of a single-word name if there's nothing else to work with.
 */
export function deriveSchoolPrefix(schoolName: string): string {
  const stopWords = new Set(["of", "the", "and", "&"]);
  const words = schoolName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w.toLowerCase()));

  if (words.length === 0) return "SCH";

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase().padEnd(2, "X");
  }

  const prefix = words
    .slice(0, 4)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return prefix;
}

/**
 * Atomically issues the next Student ID number for a school and returns
 * the formatted ID, e.g. "GVS-000123". Uses a single INSERT ... ON
 * CONFLICT DO UPDATE ... RETURNING statement, which Postgres executes
 * under a row lock - two students being added at the exact same moment
 * can never be issued the same number, unlike a naive "read current max,
 * add 1" approach.
 */
export async function generateStudentId(schoolId: string, schoolName: string): Promise<string> {
  const [row] = await db
    .insert(studentIdSequences)
    .values({ schoolId, nextNumber: 2 })
    .onConflictDoUpdate({
      target: studentIdSequences.schoolId,
      set: { nextNumber: sql`${studentIdSequences.nextNumber} + 1` },
    })
    .returning({ issued: sql<number>`${studentIdSequences.nextNumber} - 1` });

  const prefix = deriveSchoolPrefix(schoolName);
  const padded = String(row.issued).padStart(6, "0");
  return `${prefix}-${padded}`;
}
