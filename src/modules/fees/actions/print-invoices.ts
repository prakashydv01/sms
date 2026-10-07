"use server";

import { db } from "@/db";

export type PrintScope = {
  schoolId: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  invoiceId?: string;
  periodLabel?: string;
};

/**
 * Fetches invoices for printing - a single invoice, every invoice for a
 * specific student, or every invoice for a class/section (optionally
 * narrowed to one period). This backs the "print individual" and "print
 * bulk by class/section" flows with the same query, just different scope.
 */
export async function getInvoicesForPrint(scope: PrintScope) {
  const invoices = await db.query.feeInvoices.findMany({
    where: (i, { eq }) => eq(i.schoolId, scope.schoolId),
    with: {
      student: { with: { class: true, section: true, school: true } },
      assignment: { with: { feeType: true } },
    },
    orderBy: (i, { asc }) => [asc(i.createdAt)],
  });

  return invoices.filter((i) => {
    if (scope.invoiceId) return i.id === scope.invoiceId;
    if (scope.studentId) return i.studentId === scope.studentId;
    if (scope.classId && i.student.classId !== scope.classId) return false;
    if (scope.sectionId && i.student.sectionId !== scope.sectionId) return false;
    if (scope.periodLabel && i.periodLabel !== scope.periodLabel) return false;
    return true;
  });
}
