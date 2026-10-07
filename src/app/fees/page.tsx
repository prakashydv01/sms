import { db } from "@/db";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getFeeTypes } from "@/modules/fees/actions/fee-types";
import { getFeePackages } from "@/modules/fees/actions/fee-packages";
import { getFeesOverview } from "@/modules/fees/actions/invoices";
import { getClassesWithSections } from "@/modules/students/actions/get-classes";
import { FeesPageClient } from "@/modules/fees/components/fees-page-client";

export default async function FeesPage() {
  const session = await auth();
  const schoolId = session?.user.schoolId ?? "";

  const school = schoolId
    ? await db.query.schools.findFirst({ where: (s, { eq }) => eq(s.id, schoolId) })
    : undefined;

  const [feeTypes, students, invoices, classes, allPayments, allClassRates, packages] = schoolId
    ? await Promise.all([
        getFeeTypes(schoolId),
        db.query.students.findMany({
          where: (s, { eq }) => eq(s.schoolId, schoolId),
          with: { class: true, section: true },
          orderBy: (s, { asc }) => [asc(s.firstName)],
        }),
        getFeesOverview(schoolId),
        getClassesWithSections(schoolId),
        db.query.feePayments.findMany({
          with: {
            invoice: {
              with: { student: { with: { class: true } }, assignment: { with: { feeType: true } } },
            },
          },
          orderBy: (p, { desc }) => [desc(p.paidDate)],
        }),
        db.query.feeTypeClassRates.findMany({ with: { class: true } }),
        getFeePackages(schoolId),
      ])
    : [[], [], [], [], [], [], []];

  const payments = allPayments.filter((p) => p.invoice.schoolId === schoolId);
  const feeTypeIds = new Set(feeTypes.map((f) => f.id));
  const classRates = allClassRates.filter((r) => feeTypeIds.has(r.feeTypeId));

  return (
    <AppShell schoolName={school?.name} userName={session?.user.name ?? undefined} activeNav="fees">
      <FeesPageClient
        schoolId={schoolId}
        feeTypes={feeTypes.map((f) => ({
          id: f.id,
          name: f.name,
          frequency: f.frequency,
          defaultAmount: f.defaultAmount / 100,
        }))}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
        }))}
        classRates={classRates.map((r) => ({
          feeTypeId: r.feeTypeId,
          classId: r.classId,
          className: r.class.name,
          amount: r.amount / 100,
        }))}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber,
          classId: s.classId,
          className: s.class?.name,
          sectionId: s.sectionId,
          sectionName: s.section?.name,
        }))}
        invoices={invoices.map((i) => ({
          id: i.id,
          studentId: i.studentId,
          studentName: `${i.student.firstName} ${i.student.lastName}`,
          feeTypeName: i.assignment.feeType.name,
          periodLabel: i.periodLabel,
          amountDue: i.amountDue / 100,
          amountPaid: i.amountPaid / 100,
          status: i.status,
          classId: i.student.classId,
          className: i.student.class?.name,
          sectionId: i.student.sectionId,
          sectionName: i.student.section?.name,
        }))}
        payments={payments.map((p) => ({
          id: p.id,
          amount: p.amount / 100,
          paidDate: p.paidDate,
          method: p.method,
          feeTypeName: p.invoice.assignment.feeType.name,
          className: p.invoice.student.class?.name ?? "—",
        }))}
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          feeTypeIds: p.items.map((i) => i.feeTypeId),
          feeTypeNames: p.items.map((i) => i.feeType.name),
        }))}
      />
    </AppShell>
  );
}
