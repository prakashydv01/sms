"use server";

import { db } from "@/db";
import { studentFeeAssignments, feeInvoices } from "@/db/schema";
import { feeAssignmentSchema, validateWith } from "../schemas/fee.schema";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getEffectiveRate } from "./class-rates";

/**
 * Assigns a fee type to a student. If the school-wide default amount
 * doesn't apply to this student (scholarship, discount, custom rate),
 * the admin enters a different `amount` here - that's what actually
 * gets billed, not feeType.defaultAmount.
 *
 * For one_time fees, assigning also immediately creates the single
 * invoice - there's nothing to "generate later" for a one-off charge.
 */
export async function assignFeeToStudent(
  formData: FormData
): Promise<{ success: true } | { success: false; errors: Record<string, string> }> {
  const parsed = validateWith(feeAssignmentSchema, {
    studentId: formData.get("studentId"),
    feeTypeId: formData.get("feeTypeId"),
    amount: formData.get("amount"),
    discountReason: formData.get("discountReason") ?? "",
  });
  if (!parsed.success) return parsed;

  const feeType = await db.query.feeTypes.findFirst({
    where: (f, { eq }) => eq(f.id, parsed.data.feeTypeId),
  });
  if (!feeType) return { success: false, errors: { feeTypeId: "Fee type not found" } };

  const existing = await db.query.studentFeeAssignments.findFirst({
    where: and(
      eq(studentFeeAssignments.studentId, parsed.data.studentId),
      eq(studentFeeAssignments.feeTypeId, parsed.data.feeTypeId)
    ),
  });
  if (existing) {
    return { success: false, errors: { form: "This fee is already assigned to this student" } };
  }

  const amountInSmallestUnit = Math.round(parsed.data.amount * 100);

  const [assignment] = await db
    .insert(studentFeeAssignments)
    .values({
      studentId: parsed.data.studentId,
      feeTypeId: parsed.data.feeTypeId,
      amount: amountInSmallestUnit,
      discountReason: parsed.data.discountReason || null,
    })
    .returning();

  // One-time fees get their single invoice immediately - no separate
  // "generate" step makes sense for something that only bills once.
  if (feeType.frequency === "one_time") {
    const student = await db.query.students.findFirst({
      where: (s, { eq }) => eq(s.id, parsed.data.studentId),
    });
    if (student) {
      await db.insert(feeInvoices).values({
        schoolId: student.schoolId,
        studentId: student.id,
        studentFeeAssignmentId: assignment.id,
        periodLabel: null,
        amountDue: amountInSmallestUnit,
      });
    }
  }

  revalidatePath("/fees");
  return { success: true };
}

export async function getStudentFeeAssignments(studentId: string) {
  return db.query.studentFeeAssignments.findMany({
    where: (a, { eq }) => eq(a.studentId, studentId),
    with: { feeType: true },
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  });
}

/**
 * Assigns one or more fee types to every student in a class (optionally
 * narrowed to one section), each at its effective rate for that class.
 * This is the "assign to a whole class" path - for the rare student who
 * needs a different amount (scholarship, discount), use
 * assignFeeToStudent afterward to adjust just that one row; bulk
 * assignment intentionally doesn't try to handle per-student discounts,
 * since that defeats the point of "bulk."
 *
 * Students who already have a given fee type assigned are skipped for
 * that fee type (not duplicated or overwritten) - re-running this after
 * adding a mid-year transfer student, or after adding a second fee type
 * to the same class, is always safe.
 */
export async function assignFeeToClass(
  schoolId: string,
  feeTypeIds: string[],
  scope: { classId: string; sectionId?: string }
): Promise<
  | { success: true; assigned: number; skipped: number; byFeeType: { name: string; assigned: number; skipped: number }[] }
  | { success: false; error: string }
> {
  if (feeTypeIds.length === 0) {
    return { success: false, error: "Select at least one fee type" };
  }

  const targetStudents = await db.query.students.findMany({
    where: (s, { eq, and }) =>
      and(
        eq(s.schoolId, schoolId),
        eq(s.classId, scope.classId),
        scope.sectionId ? eq(s.sectionId, scope.sectionId) : undefined
      ),
  });

  if (targetStudents.length === 0) {
    return { success: false, error: "No students found in that class/section" };
  }

  let totalAssigned = 0;
  let totalSkipped = 0;
  const byFeeType: { name: string; assigned: number; skipped: number }[] = [];

  for (const feeTypeId of feeTypeIds) {
    const feeType = await db.query.feeTypes.findFirst({
      where: (f, { eq }) => eq(f.id, feeTypeId),
    });
    if (!feeType) continue;

    let assigned = 0;
    let skipped = 0;
    const rateByClassId = new Map<string, number>();

    for (const student of targetStudents) {
      const existing = await db.query.studentFeeAssignments.findFirst({
        where: and(
          eq(studentFeeAssignments.studentId, student.id),
          eq(studentFeeAssignments.feeTypeId, feeTypeId)
        ),
      });
      if (existing) {
        skipped++;
        continue;
      }

      if (!rateByClassId.has(student.classId)) {
        rateByClassId.set(student.classId, await getEffectiveRate(feeTypeId, student.classId));
      }
      const effectiveAmount = rateByClassId.get(student.classId)!;

      const [assignment] = await db
        .insert(studentFeeAssignments)
        .values({ studentId: student.id, feeTypeId, amount: effectiveAmount })
        .returning();

      if (feeType.frequency === "one_time") {
        await db.insert(feeInvoices).values({
          schoolId,
          studentId: student.id,
          studentFeeAssignmentId: assignment.id,
          periodLabel: null,
          amountDue: effectiveAmount,
        });
      }
      assigned++;
    }

    totalAssigned += assigned;
    totalSkipped += skipped;
    byFeeType.push({ name: feeType.name, assigned, skipped });
  }

  revalidatePath("/fees");
  return { success: true, assigned: totalAssigned, skipped: totalSkipped, byFeeType };
}
