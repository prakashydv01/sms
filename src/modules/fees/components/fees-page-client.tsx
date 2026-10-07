"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createFeeType, updateFeeType, deleteFeeType, deactivateFeeType } from "../actions/fee-types";
import { createFeePackage, deleteFeePackage } from "../actions/fee-packages";
import { setClassRate } from "../actions/class-rates";
import { assignFeeToStudent, assignFeeToClass } from "../actions/fee-assignments";
import { generateInvoicesForPeriod, updateInvoice, deleteInvoice } from "../actions/invoices";
import { recordPayment } from "../actions/payments";
import { DualDateField } from "@/components/dual-date-field";

type ClassOption = { id: string; name: string; sections: { id: string; name: string }[] };
type FeeType = { id: string; name: string; frequency: string; defaultAmount: number };
type StudentOption = {
  id: string;
  name: string;
  admissionNumber: string;
  classId: string;
  className?: string;
  sectionId?: string | null;
  sectionName?: string;
};
type ClassRate = { feeTypeId: string; classId: string; className: string; amount: number };
type PaymentRow = {
  id: string;
  amount: number;
  paidDate: string;
  method: string;
  feeTypeName: string;
  className: string;
};
type FeePackage = { id: string; name: string; feeTypeIds: string[]; feeTypeNames: string[] };
type InvoiceRow = {
  id: string;
  studentId: string;
  studentName: string;
  feeTypeName: string;
  periodLabel: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  classId: string;
  className?: string;
  sectionId?: string | null;
  sectionName?: string;
};

const CURRENCY = "Rs.";

export function FeesPageClient({
  schoolId,
  feeTypes,
  classes,
  classRates,
  students,
  invoices,
  payments,
  packages,
}: {
  schoolId: string;
  feeTypes: FeeType[];
  classes: ClassOption[];
  classRates: ClassRate[];
  students: StudentOption[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  packages: FeePackage[];
}) {
  const [tab, setTab] = useState<"overview" | "types" | "assign" | "reports">("overview");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Fees</h1>
        <p className="text-sm text-slate-500">Fee types, student assignments, and payment collection.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 text-sm">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </TabButton>
        <TabButton active={tab === "types"} onClick={() => setTab("types")}>
          Fee types
        </TabButton>
        <TabButton active={tab === "assign"} onClick={() => setTab("assign")}>
          Assign & generate
        </TabButton>
        <TabButton active={tab === "reports"} onClick={() => setTab("reports")}>
          Reports
        </TabButton>
      </div>

      {tab === "overview" && <OverviewTab invoices={invoices} classes={classes} feeTypes={feeTypes} />}
      {tab === "types" && (
        <FeeTypesTab
          schoolId={schoolId}
          feeTypes={feeTypes}
          classes={classes}
          classRates={classRates}
          packages={packages}
        />
      )}
      {tab === "assign" && (
        <AssignTab
          schoolId={schoolId}
          feeTypes={feeTypes}
          students={students}
          classes={classes}
          packages={packages}
          classRates={classRates}
        />
      )}
      {tab === "reports" && <ReportsTab invoices={invoices} payments={payments} classes={classes} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 font-medium ${
        active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function money(n: number) {
  return `${CURRENCY} ${n.toFixed(2)}`;
}

function OverviewTab({
  invoices,
  classes,
  feeTypes,
}: {
  invoices: InvoiceRow[];
  classes: ClassOption[];
  feeTypes: FeeType[];
}) {
  const router = useRouter();
  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [filterFeeTypeName, setFilterFeeTypeName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filterClass = classes.find((c) => c.id === filterClassId);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterClassId && inv.classId !== filterClassId) return false;
      if (filterSectionId && inv.sectionId !== filterSectionId) return false;
      if (filterFeeTypeName && inv.feeTypeName !== filterFeeTypeName) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      return true;
    });
  }, [invoices, filterClassId, filterSectionId, filterFeeTypeName, filterStatus]);

  const stats = useMemo(() => {
    const totalDue = filtered.reduce((sum, i) => sum + i.amountDue, 0);
    const totalPaid = filtered.reduce((sum, i) => sum + i.amountPaid, 0);
    const outstanding = totalDue - totalPaid;
    const overdueCount = filtered.filter((i) => i.status === "unpaid" || i.status === "partial").length;
    return { totalDue, totalPaid, outstanding, overdueCount, count: filtered.length };
  }, [filtered]);

  function handleDelete(invoiceId: string) {
    startTransition(async () => {
      const result = await deleteInvoice(invoiceId);
      if (!result.success) {
        setDeleteError((prev) => ({ ...prev, [invoiceId]: result.error }));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Invoices" value={String(stats.count)} />
        <StatCard label="Total due" value={money(stats.totalDue)} />
        <StatCard label="Collected" value={money(stats.totalPaid)} tone="good" />
        <StatCard label="Outstanding" value={money(stats.outstanding)} tone={stats.outstanding > 0 ? "warn" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={filterClassId}
          onChange={(v) => {
            setFilterClassId(v);
            setFilterSectionId("");
          }}
          placeholder="All classes"
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          value={filterSectionId}
          onChange={setFilterSectionId}
          placeholder="All sections"
          disabled={!filterClass}
          options={filterClass?.sections.map((s) => ({ value: s.id, label: s.name })) ?? []}
        />
        <FilterSelect
          value={filterFeeTypeName}
          onChange={setFilterFeeTypeName}
          placeholder="All fee types"
          options={feeTypes.map((f) => ({ value: f.name, label: f.name }))}
        />
        <FilterSelect
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="All statuses"
          options={[
            { value: "unpaid", label: "Unpaid" },
            { value: "partial", label: "Partial" },
            { value: "paid", label: "Paid" },
            { value: "waived", label: "Waived" },
          ]}
        />
        {(filterClassId || filterSectionId || filterFeeTypeName || filterStatus) && (
          <button
            onClick={() => {
              setFilterClassId("");
              setFilterSectionId("");
              setFilterFeeTypeName("");
              setFilterStatus("");
            }}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Clear filters
          </button>
        )}
        {filterClassId && (
          <a
            href={`/fees/print?classId=${filterClassId}${filterSectionId ? `&sectionId=${filterSectionId}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Print invoices for this {filterSectionId ? "section" : "class"}
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student</th>
              <th className="px-4 py-2.5 font-medium">Class</th>
              <th className="px-4 py-2.5 font-medium">Fee</th>
              <th className="px-4 py-2.5 font-medium">Period</th>
              <th className="px-4 py-2.5 font-medium text-right">Due</th>
              <th className="px-4 py-2.5 font-medium text-right">Paid</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <a href={`/fees/students/${inv.studentId}`} className="hover:underline">
                    {inv.studentName}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {inv.className}
                  {inv.sectionName ? `-${inv.sectionName}` : ""}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{inv.feeTypeName}</td>
                <td className="px-4 py-2.5 text-slate-500">{inv.periodLabel ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">{money(inv.amountDue)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">{money(inv.amountPaid)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    {inv.status !== "paid" && inv.status !== "waived" && (
                      <button onClick={() => setPayingInvoice(inv)} className="font-medium text-slate-900 underline">
                        Pay
                      </button>
                    )}
                    <button onClick={() => setEditingInvoice(inv)} className="text-slate-500 underline">
                      Edit
                    </button>
                    <a
                      href={`/fees/print?invoiceId=${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 underline"
                    >
                      Print
                    </a>
                    {inv.amountPaid === 0 && (
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={isPending}
                        className="text-red-600 underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {deleteError[inv.id] && (
                    <p className="mt-1 max-w-[180px] text-xs text-red-600">{deleteError[inv.id]}</p>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  {invoices.length === 0
                    ? 'No invoices yet — assign fees to students and generate invoices in the "Assign & generate" tab.'
                    : "No invoices match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payingInvoice && <PaymentPanel invoice={payingInvoice} onClose={() => setPayingInvoice(null)} />}
      {editingInvoice && <EditInvoicePanel invoice={editingInvoice} onClose={() => setEditingInvoice(null)} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const toneClass =
    tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PaymentPanel({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receiptInfo, setReceiptInfo] = useState<{ paymentId: string; receiptNumber: string } | null>(null);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const remaining = invoice.amountDue - invoice.amountPaid;

  function handleSubmit(formData: FormData) {
    formData.set("invoiceId", invoice.id);
    startTransition(async () => {
      const result = await recordPayment(formData);
      if (result.success) {
        router.refresh();
        setReceiptInfo({ paymentId: result.paymentId, receiptNumber: result.receiptNumber });
      } else {
        setErrors(result.errors);
      }
    });
  }

  if (receiptInfo) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Payment recorded</h2>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            Close
          </button>
        </div>
        <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Receipt {receiptInfo.receiptNumber} generated.
        </div>
        <a
          href={`/fees/receipt/${receiptInfo.paymentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          View / print receipt
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Record payment — {invoice.studentName} · {invoice.feeTypeName}
        </h2>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Remaining balance: <span className="font-medium text-slate-700">{money(remaining)}</span>
      </p>
      {errors.form && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</div>}
      <form action={handleSubmit} className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Amount</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            defaultValue={remaining.toFixed(2)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          {errors.amount && <span className="mt-1 block text-xs text-red-600">{errors.amount}</span>}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Method</span>
          <select name="method" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="online">Online</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </label>
        <DualDateField label="Date" name="paidDate" value={paidDate} onChange={setPaidDate} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</span>
          <input name="notes" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="col-span-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save payment"}
        </button>
      </form>
    </div>
  );
}

function EditInvoicePanel({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [amountDue, setAmountDue] = useState(invoice.amountDue.toFixed(2));

  function handleSave() {
    setError("");
    startTransition(async () => {
      const result = await updateInvoice(invoice.id, { amountDue: Number(amountDue) });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  function handleWaive() {
    startTransition(async () => {
      const result = await updateInvoice(invoice.id, { waive: true });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Edit invoice — {invoice.studentName} · {invoice.feeTypeName}
        </h2>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Amount due</span>
          <input
            type="number"
            step="0.01"
            value={amountDue}
            onChange={(e) => setAmountDue(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Already paid: {money(invoice.amountPaid)} — amount due can&apos;t go below this.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
          {invoice.status !== "waived" && (
            <button
              onClick={handleWaive}
              disabled={isPending}
              className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Waive this invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeeTypesTab({
  schoolId,
  feeTypes,
  classes,
  classRates,
  packages,
}: {
  schoolId: string;
  feeTypes: FeeType[];
  classes: ClassOption[];
  classRates: ClassRate[];
  packages: FeePackage[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedFeeTypeId, setExpandedFeeTypeId] = useState<string | null>(null);
  const [newClassRates, setNewClassRates] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createFeeType(schoolId, formData, newClassRates);
      if (result.success) {
        setErrors({});
        (document.getElementById("fee-type-form") as HTMLFormElement)?.reset();
        setNewClassRates({});
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <div className="space-y-5">
    <div className="grid grid-cols-2 gap-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Frequency</th>
              <th className="px-4 py-2.5 font-medium text-right">Default amount</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {feeTypes.map((f) => (
              <>
                <tr key={f.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{f.name}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{f.frequency.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">{money(f.defaultAmount)}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setExpandedFeeTypeId(expandedFeeTypeId === f.id ? null : f.id)}
                      className="text-xs font-medium text-slate-900 underline"
                    >
                      {expandedFeeTypeId === f.id ? "Hide" : "Edit"}
                    </button>
                  </td>
                </tr>
                {expandedFeeTypeId === f.id && (
                  <tr key={`${f.id}-edit`} className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={4} className="px-4 py-3">
                      <EditFeeTypePanel
                        feeType={f}
                        classes={classes}
                        classRates={classRates.filter((r) => r.feeTypeId === f.id)}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {feeTypes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                  No fee types yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add fee type</h2>
        {errors.form && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</div>}
        <form id="fee-type-form" action={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
            <input
              name="name"
              placeholder="e.g. Monthly Tuition, Admit Card Fee, ID Card Fee"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            {errors.name && <span className="mt-1 block text-xs text-red-600">{errors.name}</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Frequency</span>
            <select name="frequency" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="termly">Termly</option>
              <option value="annual">Annual</option>
            </select>
            {errors.frequency && <span className="mt-1 block text-xs text-red-600">{errors.frequency}</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Fallback amount ({CURRENCY})</span>
            <input
              name="defaultAmount"
              type="number"
              step="0.01"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Used only for classes you don&apos;t set a specific amount for below.
            </span>
            {errors.defaultAmount && <span className="mt-1 block text-xs text-red-600">{errors.defaultAmount}</span>}
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Amount per class <span className="text-slate-400">(optional — set now instead of later)</span>
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2">
              {classes.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <span className="w-16 shrink-0 text-xs text-slate-600">{c.name}</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="—"
                    value={newClassRates[c.id] ?? ""}
                    onChange={(e) => setNewClassRates((v) => ({ ...v, [c.id]: e.target.value }))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              ))}
              {classes.length === 0 && <p className="text-xs text-slate-400">No classes set up yet.</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Add fee type"}
          </button>
        </form>
      </div>
    </div>

    <PackagesManager schoolId={schoolId} feeTypes={feeTypes} packages={packages} />
    </div>
  );
}

function PackagesManager({
  schoolId,
  feeTypes,
  packages,
}: {
  schoolId: string;
  feeTypes: FeeType[];
  packages: FeePackage[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function handleCreate() {
    setError("");
    startTransition(async () => {
      const result = await createFeePackage(schoolId, name, selectedIds);
      if (result.success) {
        setName("");
        setSelectedIds([]);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(packageId: string) {
    startTransition(async () => {
      await deleteFeePackage(packageId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Fee packages</h2>
      <p className="mb-4 text-xs text-slate-500">
        Bundle fee types together (e.g. an &quot;Annual Package&quot; of Tuition + Admit Card + ID Card) so
        they can be assigned as one unit from the Assign tab. Each fee type keeps its own amount and
        frequency - a package is just a saved shortcut, not a separate price.
      </p>

      {packages.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs">
              <span>
                <span className="font-medium text-slate-900">{p.name}</span>{" "}
                <span className="text-slate-500">— {p.feeTypeNames.join(", ")}</span>
              </span>
              <button onClick={() => handleDelete(p.id)} disabled={isPending} className="text-red-600 underline">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Package name, e.g. Annual Package"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
          {feeTypes.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => toggle(f.id)} />
              {f.name}
            </label>
          ))}
          {feeTypes.length === 0 && <p className="text-xs text-slate-400">No fee types yet.</p>}
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim() || selectedIds.length === 0}
          className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Create package"}
        </button>
      </div>
    </div>
  );
}

function EditFeeTypePanel({
  feeType,
  classes,
  classRates,
}: {
  feeType: FeeType;
  classes: ClassOption[];
  classRates: ClassRate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function handleSave(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      const result = await updateFeeType(feeType.id, formData);
      if (result.success) {
        setErrors({});
        setSaved(true);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function handleDelete() {
    setDeleteError("");
    startTransition(async () => {
      const result = await deleteFeeType(feeType.id);
      if (result.success) {
        router.refresh();
      } else {
        setDeleteError(result.error);
      }
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      await deactivateFeeType(feeType.id);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Fee type details</p>
        {saved && <p className="mb-2 text-xs text-emerald-700">Saved.</p>}
        {errors.form && <p className="mb-2 text-xs text-red-600">{errors.form}</p>}
        <form action={handleSave} className="space-y-2">
          <label className="block text-xs">
            <span className="mb-1 block text-slate-500">Name</span>
            <input
              name="name"
              defaultValue={feeType.name}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            {errors.name && <span className="mt-1 block text-red-600">{errors.name}</span>}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-slate-500">Frequency</span>
            <select
              name="frequency"
              defaultValue={feeType.frequency}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="termly">Termly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-slate-500">Fallback amount ({CURRENCY})</span>
            <input
              name="defaultAmount"
              type="number"
              step="0.01"
              defaultValue={feeType.defaultAmount}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            {errors.defaultAmount && <span className="mt-1 block text-red-600">{errors.defaultAmount}</span>}
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
          <p className="text-xs text-slate-400">
            Editing this doesn&apos;t change amounts already assigned to students or invoices already
            generated — only affects future assignments.
          </p>
        </form>

        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          {deleteError && <p className="mb-2 text-xs text-red-800">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={handleDeactivate}
              disabled={isPending}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Deactivate instead
            </button>
          </div>
          <p className="mt-2 text-xs text-red-700">
            Delete only works if this fee type has never been assigned to a student. Deactivate hides
            it from future use without touching existing records.
          </p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Per-class rates</p>
        <ClassRatesEditor feeType={feeType} classes={classes} classRates={classRates} />
      </div>
    </div>
  );
}

function ClassRatesEditor({
  feeType,
  classes,
  classRates,
}: {
  feeType: FeeType;
  classes: ClassOption[];
  classRates: ClassRate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const c of classes) {
      const override = classRates.find((r) => r.classId === c.id);
      initial[c.id] = override ? override.amount.toFixed(2) : "";
    }
    return initial;
  });

  function handleSave(classId: string) {
    const raw = values[classId]?.trim();
    const amount = raw ? Number(raw) : null;
    startTransition(async () => {
      await setClassRate(feeType.id, classId, amount);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Leave blank to use the fallback amount ({money(feeType.defaultAmount)}).
      </p>
      <div className="space-y-1.5">
        {classes.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-600">{c.name}</span>
            <input
              type="number"
              step="0.01"
              placeholder={feeType.defaultAmount.toFixed(2)}
              value={values[c.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <button
              onClick={() => handleSave(c.id)}
              disabled={isPending}
              className="text-xs font-medium text-slate-900 underline disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignTab({
  schoolId,
  feeTypes,
  students,
  classes,
  classRates,
  packages,
}: {
  schoolId: string;
  feeTypes: FeeType[];
  students: StudentOption[];
  classes: ClassOption[];
  classRates: ClassRate[];
  packages: FeePackage[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"individual" | "class">("class");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");

  // Whole-class mode: multiple fee types can be assigned in one action.
  const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>([]);
  function toggleFeeType(id: string) {
    setSelectedFeeTypeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  // Applying a package just pre-checks its fee types into the same
  // multi-select above - still fully editable afterward, since a package
  // is a starting point, not a locked bundle.
  function applyPackage(packageId: string) {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;
    setSelectedFeeTypeIds((ids) => [...new Set([...ids, ...pkg.feeTypeIds])]);
  }

  // Individual mode: narrow the (potentially huge) student list by class
  // and section first, since scrolling through every student in the
  // school to find one is impractical past a handful of classes.
  const [individualClassId, setIndividualClassId] = useState("");
  const [individualSectionId, setIndividualSectionId] = useState("");
  const individualClass = classes.find((c) => c.id === individualClassId);
  const filteredStudents = students.filter((s) => {
    if (individualClassId && s.classId !== individualClassId) return false;
    if (individualSectionId && s.sectionId !== individualSectionId) return false;
    return true;
  });

  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState("");
  const selectedFeeType = feeTypes.find((f) => f.id === selectedFeeTypeId);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // The amount to prefill for an individual assignment: the class-specific
  // rate if one's been set for this fee type + student's class, otherwise
  // the fee type's flat default. Admin can still override before saving.
  const prefillAmount = (() => {
    if (!selectedFeeType) return undefined;
    if (selectedStudent) {
      const override = classRates.find(
        (r) => r.feeTypeId === selectedFeeType.id && r.classId === selectedStudent.classId
      );
      if (override) return override.amount;
    }
    return selectedFeeType.defaultAmount;
  })();

  const [assignClassId, setAssignClassId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");
  const assignClass = classes.find((c) => c.id === assignClassId);

  const [genFrequency, setGenFrequency] = useState<"monthly" | "termly" | "annual">("monthly");
  const [genPeriod, setGenPeriod] = useState("");
  const [genClassId, setGenClassId] = useState("");
  const [genSectionId, setGenSectionId] = useState("");
  const genClass = classes.find((c) => c.id === genClassId);
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);

  function handleAssignIndividual(formData: FormData) {
    setSuccess("");
    startTransition(async () => {
      const result = await assignFeeToStudent(formData);
      if (result.success) {
        setErrors({});
        setSuccess("Fee assigned.");
        (document.getElementById("assign-fee-form") as HTMLFormElement)?.reset();
        setSelectedStudentId("");
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function handleAssignClass() {
    setSuccess("");
    setErrors({});
    if (selectedFeeTypeIds.length === 0) {
      setErrors({ feeTypeId: "Select at least one fee type" });
      return;
    }
    if (!assignClassId) {
      setErrors({ classId: "Select a class" });
      return;
    }
    startTransition(async () => {
      const result = await assignFeeToClass(schoolId, selectedFeeTypeIds, {
        classId: assignClassId,
        sectionId: assignSectionId || undefined,
      });
      if (result.success) {
        const summary = result.byFeeType.map((f) => `${f.name}: ${f.assigned} assigned, ${f.skipped} already had it`);
        setSuccess(summary.join(" · "));
        setSelectedFeeTypeIds([]);
        router.refresh();
      } else {
        setErrors({ form: result.error });
      }
    });
  }

  function handleGenerate() {
    if (!genPeriod.trim()) {
      setErrors({ period: "Enter a period label, e.g. April 2026" });
      return;
    }
    startTransition(async () => {
      const result = await generateInvoicesForPeriod(schoolId, genFrequency, genPeriod.trim(), {
        classId: genClassId || undefined,
        sectionId: genSectionId || undefined,
      });
      setGenResult(result);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Assign a fee</h2>
          <div className="flex rounded-md border border-slate-300 p-0.5 text-xs">
            <button
              onClick={() => setMode("class")}
              className={`rounded px-2.5 py-1 font-medium ${mode === "class" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Whole class
            </button>
            <button
              onClick={() => setMode("individual")}
              className={`rounded px-2.5 py-1 font-medium ${mode === "individual" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Individual
            </button>
          </div>
        </div>

        {success && <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        {errors.form && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</div>}

        {mode === "class" ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Assigns the fee type&apos;s standard rate to every student in the class/section. For
              scholarships or discounts on individual students, use &quot;Individual&quot; instead.
            </p>
            {packages.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Quick-select a package</span>
                <select
                  value=""
                  onChange={(e) => e.target.value && applyPackage(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">Choose a package to pre-check its fee types...</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.feeTypeNames.join(", ")})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Fee types <span className="text-red-500">*</span>
              </span>
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-slate-300 p-2">
                {feeTypes.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedFeeTypeIds.includes(f.id)}
                      onChange={() => toggleFeeType(f.id)}
                    />
                    <span>
                      {f.name} <span className="text-slate-400">({f.frequency.replace("_", " ")}) — {money(f.defaultAmount)}</span>
                    </span>
                  </label>
                ))}
                {feeTypes.length === 0 && <p className="text-xs text-slate-400">No fee types yet.</p>}
              </div>
              {errors.feeTypeId && <span className="mt-1 block text-xs text-red-600">{errors.feeTypeId}</span>}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Class</span>
              <select
                value={assignClassId}
                onChange={(e) => {
                  setAssignClassId(e.target.value);
                  setAssignSectionId("");
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.classId && <span className="mt-1 block text-xs text-red-600">{errors.classId}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Section (optional)</span>
              <select
                value={assignSectionId}
                onChange={(e) => setAssignSectionId(e.target.value)}
                disabled={!assignClass}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
              >
                <option value="">All sections</option>
                {assignClass?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={handleAssignClass}
              disabled={isPending}
              className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isPending ? "Assigning..." : "Assign to class"}
            </button>
          </div>
        ) : (
          <form id="assign-fee-form" action={handleAssignIndividual} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Filter by class</span>
                <select
                  value={individualClassId}
                  onChange={(e) => {
                    setIndividualClassId(e.target.value);
                    setIndividualSectionId("");
                    setSelectedStudentId("");
                  }}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Filter by section</span>
                <select
                  value={individualSectionId}
                  onChange={(e) => {
                    setIndividualSectionId(e.target.value);
                    setSelectedStudentId("");
                  }}
                  disabled={!individualClass}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                >
                  <option value="">All sections</option>
                  {individualClass?.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Student <span className="text-slate-400">({filteredStudents.length} shown)</span>
              </span>
              <select
                name="studentId"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select...</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNumber})
                  </option>
                ))}
              </select>
              {errors.studentId && <span className="mt-1 block text-xs text-red-600">{errors.studentId}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Fee type</span>
              <select
                name="feeTypeId"
                value={selectedFeeTypeId}
                onChange={(e) => setSelectedFeeTypeId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Select...</option>
                {feeTypes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.frequency.replace("_", " ")})
                  </option>
                ))}
              </select>
              {errors.feeTypeId && <span className="mt-1 block text-xs text-red-600">{errors.feeTypeId}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Amount ({CURRENCY})</span>
              <input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={prefillAmount}
                key={`${selectedFeeTypeId}-${selectedStudentId}`}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              {prefillAmount !== undefined && (
                <span className="mt-1 block text-xs text-slate-400">
                  Pre-filled from {selectedStudent ? `${selectedStudent.className}'s rate` : "the fee type's default"} — edit for a scholarship/discount.
                </span>
              )}
              {errors.amount && <span className="mt-1 block text-xs text-red-600">{errors.amount}</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Discount reason (optional)</span>
              <input
                name="discountReason"
                placeholder="e.g. 50% merit scholarship"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Assign fee"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Generate recurring invoices</h2>
        <p className="mb-4 text-xs text-slate-500">
          For monthly/termly/annual fees — creates one invoice per assigned student for the period
          below, optionally scoped to a class/section. Safe to run again; already-generated invoices
          are skipped, not duplicated.
        </p>
        {errors.period && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.period}</div>}
        {genResult && (
          <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {genResult.created} invoice(s) created, {genResult.skipped} already existed.
          </div>
        )}
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Frequency</span>
            <select
              value={genFrequency}
              onChange={(e) => setGenFrequency(e.target.value as typeof genFrequency)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="termly">Termly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Period label</span>
            <input
              value={genPeriod}
              onChange={(e) => setGenPeriod(e.target.value)}
              placeholder="e.g. April 2026"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Class (optional)</span>
              <select
                value={genClassId}
                onChange={(e) => {
                  setGenClassId(e.target.value);
                  setGenSectionId("");
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Section (optional)</span>
              <select
                value={genSectionId}
                onChange={(e) => setGenSectionId(e.target.value)}
                disabled={!genClass}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
              >
                <option value="">All sections</option>
                {genClass?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? "Generating..." : "Generate invoices"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({
  invoices,
  payments,
  classes,
}: {
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  classes: ClassOption[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);

  const filteredPayments = useMemo(
    () => payments.filter((p) => p.paidDate >= from && p.paidDate <= to),
    [payments, from, to]
  );

  const collectionByFeeType = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPayments) {
      map.set(p.feeTypeName, (map.get(p.feeTypeName) ?? 0) + p.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPayments]);

  const collectionByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPayments) {
      map.set(p.className, (map.get(p.className) ?? 0) + p.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPayments]);

  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  const outstandingByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "unpaid" || inv.status === "partial") {
        const key = inv.className ?? "—";
        map.set(key, (map.get(key) ?? 0) + (inv.amountDue - inv.amountPaid));
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  const overdueInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "unpaid" || i.status === "partial")
        .sort((a, b) => b.amountDue - a.amountDue),
    [invoices]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Collection report</h2>
        <div className="mb-3 flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <span className="ml-2 font-mono font-semibold text-slate-900">
            Total collected: {money(totalCollected)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReportTable title="By fee type" rows={collectionByFeeType} />
          <ReportTable title="By class" rows={collectionByClass} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Outstanding dues</h2>
        <div className="grid grid-cols-2 gap-4">
          <ReportTable title="By class" rows={outstandingByClass} tone="warn" />
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.slice(0, 10).map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">{inv.studentName}</td>
                    <td className="px-3 py-2 text-slate-500">{inv.feeTypeName}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {money(inv.amountDue - inv.amountPaid)}
                    </td>
                  </tr>
                ))}
                {overdueInvoices.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                      Nothing outstanding.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: [string, number][];
  tone?: "warn";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        {title}
      </div>
      <table className="w-full text-left text-xs">
        <tbody>
          {rows.map(([label, amount]) => (
            <tr key={label} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-slate-700">{label}</td>
              <td className={`px-3 py-2 text-right font-mono ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>
                {money(amount)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-slate-400">
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
