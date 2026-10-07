"use server";

import { db } from "@/db";
import { students } from "@/db/schema";
import { studentSchema } from "../schemas/student.schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Same shape as studentSchema, plus status - which is editable after
// creation (active/inactive/graduated/transferred) but not part of the
// initial creation flow, where every new student starts "active".
const updateStudentSchema = studentSchema.extend({
  status: z.enum(["active", "inactive", "graduated", "transferred"]),
});

export type UpdateStudentResult =
  | { success: true }
  | { success: false; errors: Record<string, string> };

export async function updateStudent(
  studentId: string,
  formData: FormData
): Promise<UpdateStudentResult> {
  const parsed = updateStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    guardianName: formData.get("guardianName"),
    guardianPhone: formData.get("guardianPhone"),
    guardianEmail: formData.get("guardianEmail") ?? "",
    fatherName: formData.get("fatherName") ?? "",
    motherName: formData.get("motherName") ?? "",
    address: formData.get("address") ?? "",
    admissionDate: formData.get("admissionDate"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    return { success: false, errors };
  }

  const data = parsed.data;

  try {
    await db
      .update(students)
      .set({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        classId: data.classId,
        sectionId: data.sectionId || null,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        guardianEmail: data.guardianEmail || null,
        fatherName: data.fatherName || null,
        motherName: data.motherName || null,
        address: data.address || null,
        admissionDate: data.admissionDate,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));
  } catch {
    return { success: false, errors: { form: "Could not save changes. Please try again." } };
  }

  revalidatePath("/students");
  revalidatePath(`/fees/students/${studentId}`);
  return { success: true };
}

/**
 * Quick status-only change - used as the "soft delete" path when a full
 * delete is blocked because the student has financial history. Doesn't
 * require re-validating the whole student record.
 */
export async function updateStudentStatus(
  studentId: string,
  status: "active" | "inactive" | "graduated" | "transferred"
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await db.update(students).set({ status, updatedAt: new Date() }).where(eq(students.id, studentId));
  } catch {
    return { success: false, error: "Could not update status." };
  }
  revalidatePath("/students");
  return { success: true };
}

/**
 * Deletes a student outright - only allowed when they have no fee
 * assignments, invoices, or payments at all. A student with financial
 * history should be marked inactive/transferred/graduated instead of
 * deleted, so payment records never end up pointing at a vanished
 * student - the same principle as "waive, don't delete" for invoices.
 */
export async function deleteStudent(
  studentId: string
): Promise<{ success: true } | { success: false; error: string; hasFinancialHistory: boolean }> {
  const assignmentCount = await db.query.studentFeeAssignments.findFirst({
    where: (a, { eq }) => eq(a.studentId, studentId),
  });

  if (assignmentCount) {
    return {
      success: false,
      error:
        "This student has fee assignments or payment history and can't be deleted - mark them as inactive/transferred/graduated instead to preserve financial records.",
      hasFinancialHistory: true,
    };
  }

  try {
    await db.delete(students).where(eq(students.id, studentId));
  } catch {
    return { success: false, error: "Could not delete student. Please try again.", hasFinancialHistory: false };
  }

  revalidatePath("/students");
  return { success: true };
}
