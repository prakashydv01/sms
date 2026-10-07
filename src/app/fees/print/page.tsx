import { auth } from "@/lib/auth";
import { getInvoicesForPrint } from "@/modules/fees/actions/print-invoices";
import { PrintButton } from "../receipt/[paymentId]/print-button";

const CURRENCY = "Rs.";

export default async function PrintInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    classId?: string;
    sectionId?: string;
    studentId?: string;
    invoiceId?: string;
    period?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const schoolId = session?.user.schoolId ?? "";

  const invoices = schoolId
    ? await getInvoicesForPrint({
        schoolId,
        classId: params.classId,
        sectionId: params.sectionId,
        studentId: params.studentId,
        invoiceId: params.invoiceId,
        periodLabel: params.period,
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">{invoices.length} invoice(s) to print</p>
        <PrintButton />
      </div>

      {invoices.length === 0 && (
        <p className="text-center text-sm text-slate-400">No invoices match this selection.</p>
      )}

      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="mb-6 border border-slate-200 p-8 print:mb-0 print:break-after-page print:border-0"
        >
          <div className="mb-6 flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{invoice.student.school.name}</h1>
              {invoice.student.school.address && (
                <p className="text-sm text-slate-500">{invoice.student.school.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Fee bill</p>
              <p className="font-mono text-sm font-medium text-slate-900">
                {invoice.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Student</p>
              <p className="font-medium text-slate-900">
                {invoice.student.firstName} {invoice.student.lastName}
              </p>
              <p className="text-slate-500">
                {invoice.student.class?.name}
                {invoice.student.section?.name ? `-${invoice.student.section.name}` : ""} · ID:{" "}
                {invoice.student.admissionNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Due date</p>
              <p className="font-medium text-slate-900">
                {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          <table className="mb-6 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2">Fee</th>
                <th className="pb-2">Period</th>
                <th className="pb-2 text-right">Amount due</th>
                <th className="pb-2 text-right">Paid</th>
                <th className="pb-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-900">{invoice.assignment.feeType.name}</td>
                <td className="py-2 text-slate-500">{invoice.periodLabel ?? "One-time"}</td>
                <td className="py-2 text-right font-mono text-slate-900">
                  {CURRENCY} {(invoice.amountDue / 100).toFixed(2)}
                </td>
                <td className="py-2 text-right font-mono text-slate-900">
                  {CURRENCY} {(invoice.amountPaid / 100).toFixed(2)}
                </td>
                <td className="py-2 text-right font-mono font-medium text-slate-900">
                  {CURRENCY} {((invoice.amountDue - invoice.amountPaid) / 100).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-400">
            <span className="capitalize">Status: {invoice.status}</span>
            <span>Issued {new Date(invoice.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
