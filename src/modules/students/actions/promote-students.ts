"use server";

import { db } from "@/db";
import { students, studentFeeAssignments } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getEffectiveRate } from "@/modules/fees/actions/class-rates";

export type PromoteStudentsResult = {
  promoted: number;
  feeAssignmentsUpdated: number;
};

/**
 * Moves the given students to a new class/section - this is what "class
 * 1 to class 2" promotion actually does under the hood. Deliberately
 * takes an explicit list of student IDs rather than "everyone in class
 * X", so the calling UI can let the admin uncheck a student who's being
 * held back before confirming.
 *
 * If updateFeeRates is true, each promoted student's RECURRING fee
 * assignments (monthly/termly/annual) have their amount updated to the
 * new class's effective rate - e.g. moving from Grade 1 (tuition 1000)
 * to Grade 2 (tuition 1200) updates the assignment so future invoices
 * bill 1200. One-time fees (already tied to a specific invoice already
 * generated) are left untouched. Crucially, this never touches
 * already-generated invoices or past payments - only the ongoing
 * assignment amount used for FUTURE invoice generation.
 */
export async function promoteStudents(
  studentIds: string[],
  toClassId: string,
  toSectionId: string | undefined,
  updateFeeRates: boolean
): Promise<PromoteStudentsResult> {
  if (studentIds.length === 0) {
    return { promoted: 0, feeAssignmentsUpdated: 0 };
  }

  await db
    .update(students)
    .set({ classId: toClassId, sectionId: toSectionId || null, updatedAt: new Date() })
    .where(inArray(students.id, studentIds));

  let feeAssignmentsUpdated = 0;

  if (updateFeeRates) {
    const assignments = await db.query.studentFeeAssignments.findMany({
      where: and(inArray(studentFeeAssignments.studentId, studentIds), eq(studentFeeAssignments.isActive, true)),
      with: { feeType: true },
    });

    for (const assignment of assignments) {
      if (assignment.feeType.frequency === "one_time") continue; // already invoiced, not a forward-looking rate

      const newAmount = await getEffectiveRate(assignment.feeTypeId, toClassId);
      if (newAmount !== assignment.amount) {
        await db
          .update(studentFeeAssignments)
          .set({ amount: newAmount })
          .where(eq(studentFeeAssignments.id, assignment.id));
        feeAssignmentsUpdated++;
      }
    }
  }

  revalidatePath("/students");
  revalidatePath("/fees");
  return { promoted: studentIds.length, feeAssignmentsUpdated };
}
