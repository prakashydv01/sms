"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { importBatches, students } from "@/db/schema";
import { createStudent } from "./create-student";
import type { ImportRowResult } from "./validate-import-rows";
import { eq } from "drizzle-orm";

export type CommitImportResult = {
  batchId: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  failures: { rowNumber: number; error: string }[];
};

/**
 * Only rows with status "ok" or "warning" are committed - "error" rows are
 * never sent here, they stay in the browser for the admin to fix and
 * re-validate. Every inserted row is tagged with importBatchId, which is
 * what makes "undo this import" possible later without extra schema work.
 */
export async function commitImport(
  schoolId: string,
  fileName: string,
  rows: ImportRowResult[]
): Promise<CommitImportResult> {
  const importableRows = rows.filter((r) => r.status !== "error");

  const [batch] = await db
    .insert(importBatches)
    .values({
      schoolId,
      entityType: "students",
      fileName,
      status: "processing",
      totalRows: rows.length,
    })
    .returning();

  const failures: { rowNumber: number; error: string }[] = [];
  let successCount = 0;

  // Sequential, not Promise.all - Student IDs are issued via an atomic
  // per-school counter (see generateStudentId), so sequential execution
  // here isn't required for uniqueness anymore, but it keeps failure
  // reporting simple and predictable (row N's error never depends on
  // timing of row N+1).
  for (const row of importableRows) {
    const result = await createStudent(
      schoolId,
      {
        firstName: row.data.firstName,
        lastName: row.data.lastName,
        dateOfBirth: row.data.dateOfBirth,
        gender: row.data.gender as "male" | "female" | "other",
        classId: row.data.classId,
        sectionId: row.data.sectionId || undefined,
        guardianName: row.data.guardianName,
        guardianPhone: row.data.guardianPhone,
        guardianEmail: row.data.guardianEmail || undefined,
        fatherName: row.data.fatherName || undefined,
        motherName: row.data.motherName || undefined,
        address: row.data.address || undefined,
        admissionDate: row.data.admissionDate,
        extraFields: row.extraFields,
      },
      batch.id
    );

    if (result.success) {
      successCount++;
    } else {
      const message = Object.values(result.errors)[0] ?? "Unknown error";
      failures.push({ rowNumber: row.rowNumber, error: message });
    }
  }

  const failedCount = rows.length - successCount;
  await db
    .update(importBatches)
    .set({
      status: failedCount === 0 ? "completed" : "completed_with_errors",
      successRows: successCount,
      failedRows: failedCount,
    })
    .where(eq(importBatches.id, batch.id));

  revalidatePath("/students");

  return {
    batchId: batch.id,
    totalRows: rows.length,
    successRows: successCount,
    failedRows: failedCount,
    failures,
  };
}

/**
 * Undo support: every row from a batch is deletable in one shot because
 * they're all tagged with importBatchId. This is why that column exists
 * on students from day one instead of being bolted on later.
 */
export async function undoImportBatch(batchId: string): Promise<{ deleted: number }> {
  const deleted = await db
    .delete(students)
    .where(eq(students.importBatchId, batchId))
    .returning({ id: students.id });

  await db.update(importBatches).set({ status: "failed" }).where(eq(importBatches.id, batchId));

  revalidatePath("/students");
  return { deleted: deleted.length };
}
