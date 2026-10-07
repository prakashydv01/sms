import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { AppShell } from "@/components/app-shell";
import { getStudentFeeLedger } from "@/modules/fees/actions/invoices";

const CURRENCY = "Rs.";

export default async function StudentLedgerPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await auth();
  const schoolId = session?.user.schoolId ?? "";

  const school = schoolId
    ? await db.query.schools.findFirst({ where: (s, { eq }) => eq(s.id, schoolId) })
    : undefined;

  const ledger = await getStudentFeeLedger(studentId);
  if (!ledger || ledger.student.schoolId !== schoolId) notFound();

  const { student, assignments, totals } = ledger;
  const balance = totals.totalDue - totals.totalPaid;

  return (
    <AppShell schoolName={school?.name} userName={session?.user.name ?? undefined} activeNav="fees">
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/fees" className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to Fees
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">
              {student.firstName} {student.lastName}
            </h1>
            <p className="text-sm text-slate-500">
              {student.class?.name}
              {student.section?.name ? `-${student.section.name}` : ""} · ID: {student.admissionNumber}
            </p>
          </div>
          <a
            href={`/fees/print?studentId=${studentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print all invoices
          </a>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total billed" value={`${CURRENCY} ${(totals.totalDue / 100).toFixed(2)}`} />
          <StatCard label="Total paid" value={`${CURRENCY} ${(totals.totalPaid / 100).toFixed(2)}`} tone="good" />
          <StatCard
            label="Balance"
            value={`${CURRENCY} ${(balance / 100).toFixed(2)}`}
            tone={balance > 0 ? "warn" : undefined}
          />
        </div>

        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-slate-900">{assignment.feeType.name}</span>
                <span className="text-xs capitalize text-slate-500">
                  {assignment.feeType.frequency.replace("_", " ")}
                  {assignment.discountReason ? ` · ${assignment.discountReason}` : ""}
                </span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Period</th>
                    <th className="px-4 py-2 font-medium text-right">Due</th>
                    <th className="px-4 py-2 font-medium text-right">Paid</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {assignment.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-600">{invoice.periodLabel ?? "One-time"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {CURRENCY} {(invoice.amountDue / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {CURRENCY} {(invoice.amountPaid / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          {invoice.payments.map((p) => (
                            <Link
                              key={p.id}
                              href={`/fees/receipt/${p.id}`}
                              target="_blank"
                              className="text-xs font-medium text-slate-900 underline"
                            >
                              {p.receiptNumber}
                            </Link>
                          ))}
                          {invoice.payments.length === 0 && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assignment.invoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-xs text-slate-400">
                        No invoices generated yet for this fee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
          {assignments.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
              No fees assigned to this student yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    unpaid: "bg-red-50 text-red-700",
    partial: "bg-amber-50 text-amber-700",
    paid: "bg-emerald-50 text-emerald-700",
    waived: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
