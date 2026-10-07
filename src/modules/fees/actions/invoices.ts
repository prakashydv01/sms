"use server";

import { db } from "@/db";
import { feeInvoices, studentFeeAssignments } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

/**
 * Generates one invoice per active student-fee-assignment for a given
 * recurring frequency + period (e.g. all "monthly" assignments for
 * "April 2026"), optionally scoped to one class and/or section. Safe to
 * click twice - the unique constraint on (studentFeeAssignmentId,
 * periodLabel) means an existing invoice for that period is just
 * skipped, never duplicated.
 */
export async function generateInvoicesForPeriod(
  schoolId: string,
  frequency: "monthly" | "termly" | "annual",
  periodLabel: string,
  scope?: { classId?: string; sectionId?: string }
): Promise<{ created: number; skipped: number }> {
  const assignments = await db.query.studentFeeAssignments.findMany({
    where: eq(studentFeeAssignments.isActive, true),
    with: { feeType: true, student: true },
  });

  const relevant = assignments.filter((a) => {
    if (a.feeType.frequency !== frequency) return false;
    if (a.student.schoolId !== schoolId) return false;
    if (scope?.classId && a.student.classId !== scope.classId) return false;
    if (scope?.sectionId && a.student.sectionId !== scope.sectionId) return false;
    return true;
  });

  let created = 0;
  let skipped = 0;

  for (const assignment of relevant) {
    const existing = await db.query.feeInvoices.findFirst({
      where: and(
        eq(feeInvoices.studentFeeAssignmentId, assignment.id),
        eq(feeInvoices.periodLabel, periodLabel)
      ),
    });
    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(feeInvoices).values({
      schoolId,
      studentId: assignment.studentId,
      studentFeeAssignmentId: assignment.id,
      periodLabel,
      amountDue: assignment.amount,
    });
    created++;
  }

  revalidatePath("/fees");
  return { created, skipped };
}

export async function getInvoicesForStudent(studentId: string) {
  return db.query.feeInvoices.findMany({
    where: (i, { eq }) => eq(i.studentId, studentId),
    with: { assignment: { with: { feeType: true } }, payments: true },
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });
}

/**
 * Full fee history for one student - every assignment, every invoice
 * across every period, every payment - for the ledger/statement view.
 * This is the "one screen, everything about this student's fees" page.
 */
export async function getStudentFeeLedger(studentId: string) {
  const student = await db.query.students.findFirst({
    where: (s, { eq }) => eq(s.id, studentId),
    with: { class: true, section: true, school: true },
  });
  if (!student) return null;

  const assignments = await db.query.studentFeeAssignments.findMany({
    where: (a, { eq }) => eq(a.studentId, studentId),
    with: {
      feeType: true,
      invoices: { with: { payments: { orderBy: (p, { desc }) => [desc(p.paidDate)] } } },
    },
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  });

  const allInvoices = assignments.flatMap((a) => a.invoices);
  const totals = {
    totalDue: allInvoices.reduce((sum, i) => sum + i.amountDue, 0),
    totalPaid: allInvoices.reduce((sum, i) => sum + i.amountPaid, 0),
  };

  return { student, assignments, totals };
}

/**
 * Full overview dataset for the Fees page - includes class/section via the
 * student relation so the UI can filter without extra round trips.
 */
export async function getFeesOverview(schoolId: string) {
  return db.query.feeInvoices.findMany({
    where: (i, { eq }) => eq(i.schoolId, schoolId),
    with: {
      student: { with: { class: true, section: true } },
      assignment: { with: { feeType: true } },
    },
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });
}

/**
 * Edits an invoice's amount due / due date, or marks it waived. Reducing
 * amountDue below what's already been paid would leave a nonsensical
 * negative balance, so that's blocked - waive it instead if the intent
 * is "this student doesn't owe this anymore."
 */
export async function updateInvoice(
  invoiceId: string,
  updates: { amountDue?: number; dueDate?: string; waive?: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  const invoice = await db.query.feeInvoices.findFirst({
    where: (i, { eq }) => eq(i.id, invoiceId),
  });
  if (!invoice) return { success: false, error: "Invoice not found" };

  if (updates.waive) {
    await db
      .update(feeInvoices)
      .set({ status: "waived" })
      .where(eq(feeInvoices.id, invoiceId));
    revalidatePath("/fees");
    return { success: true };
  }

  const newAmountDue =
    updates.amountDue !== undefined ? Math.round(updates.amountDue * 100) : invoice.amountDue;

  if (newAmountDue < invoice.amountPaid) {
    return {
      success: false,
      error: `Can't set amount due below what's already paid (${(invoice.amountPaid / 100).toFixed(2)})`,
    };
  }

  const newStatus =
    invoice.status === "waived"
      ? "waived"
      : invoice.amountPaid >= newAmountDue
      ? "paid"
      : invoice.amountPaid > 0
      ? "partial"
      : "unpaid";

  await db
    .update(feeInvoices)
    .set({
      amountDue: newAmountDue,
      dueDate: updates.dueDate ?? invoice.dueDate,
      status: newStatus,
    })
    .where(eq(feeInvoices.id, invoiceId));

  revalidatePath("/fees");
  return { success: true };
}

/**
 * Deletes an invoice outright - only allowed when no payment has ever
 * been recorded against it. An invoice with payment history should be
 * waived, not deleted, so the payment ledger never points at a vanished
 * invoice.
 */
export async function deleteInvoice(
  invoiceId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const invoice = await db.query.feeInvoices.findFirst({
    where: (i, { eq }) => eq(i.id, invoiceId),
  });
  if (!invoice) return { success: false, error: "Invoice not found" };

  if (invoice.amountPaid > 0) {
    return {
      success: false,
      error: "This invoice has payments recorded - waive it instead of deleting, to preserve the payment history.",
    };
  }

  await db.delete(feeInvoices).where(eq(feeInvoices.id, invoiceId));
  revalidatePath("/fees");
  return { success: true };
}
