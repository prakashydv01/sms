import { notFound } from "next/navigation";
import { getReceiptData } from "@/modules/fees/actions/receipts";
import { formatBs } from "@/lib/nepali-date";
import { PrintButton } from "./print-button";

const CURRENCY = "Rs.";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const payment = await getReceiptData(paymentId);
  if (!payment) notFound();

  const { invoice } = payment;
  const student = invoice.student;
  const school = student.school;

  return (
    <div className="mx-auto min-h-screen max-w-xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="border border-slate-200 p-8">
        <div className="mb-6 flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-lg font-semibold">{school.name}</h1>
            {school.address && <p className="text-sm text-slate-500">{school.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Receipt</p>
            <p className="font-mono text-sm font-medium">{payment.receiptNumber}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Student</p>
            <p className="font-medium">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-slate-500">
              {student.class?.name}
              {student.section?.name ? `-${student.section.name}` : ""} · ID: {student.admissionNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Date paid</p>
            <p className="font-medium">{new Date(payment.paidDate).toLocaleDateString()}</p>
            <p className="text-xs text-slate-400">BS {formatBs(payment.paidDate)}</p>
          </div>
        </div>

        <table className="mb-6 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-2">Fee</th>
              <th className="pb-2">Period</th>
              <th className="pb-2 text-right">Amount paid</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2">{invoice.assignment.feeType.name}</td>
              <td className="py-2 text-slate-500">{invoice.periodLabel ?? "—"}</td>
              <td className="py-2 text-right font-mono">
                {CURRENCY} {(payment.amount / 100).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mb-6 flex justify-between border-t border-slate-200 pt-4 text-sm">
          <span className="text-slate-500">Payment method</span>
          <span className="font-medium capitalize">{payment.method.replace("_", " ")}</span>
        </div>

        {payment.notes && (
          <div className="mb-6 text-sm text-slate-500">
            <span className="text-xs uppercase tracking-wide text-slate-400">Notes: </span>
            {payment.notes}
          </div>
        )}

        <div className="border-t border-slate-200 pt-4 text-xs text-slate-400">
          {payment.recordedByUser && <p>Recorded by {payment.recordedByUser.name}</p>}
          <p>Issued {new Date(payment.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
