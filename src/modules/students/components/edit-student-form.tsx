"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudent, updateStudentStatus, deleteStudent } from "../actions/update-student";
import { DualDateField } from "@/components/dual-date-field";

type ClassOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

type StudentRow = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  classId: string;
  sectionId: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  fatherName: string | null;
  motherName: string | null;
  address: string | null;
  admissionDate: string;
  status: string;
};

export function EditStudentForm({
  student,
  classes,
  onClose,
}: {
  student: StudentRow;
  classes: ClassOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<{ message: string; hasFinancialHistory: boolean } | null>(null);

  const [values, setValues] = useState({
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    classId: student.classId,
    sectionId: student.sectionId ?? "",
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail ?? "",
    fatherName: student.fatherName ?? "",
    motherName: student.motherName ?? "",
    address: student.address ?? "",
    admissionDate: student.admissionDate,
    status: student.status,
  });

  const selectedClass = classes.find((c) => c.id === values.classId);

  function setField(name: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    for (const [key, val] of Object.entries(values)) {
      formData.set(key, val);
    }
    startTransition(async () => {
      const result = await updateStudent(student.id, formData);
      if (result.success) {
        setErrors({});
        setSuccess(true);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setDeleteError({ message: result.error, hasFinancialHistory: result.hasFinancialHistory });
      }
    });
  }

  function handleQuickStatus(status: "inactive" | "transferred" | "graduated") {
    startTransition(async () => {
      const result = await updateStudentStatus(student.id, status);
      if (result.success) {
        setDeleteError(null);
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {success && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Changes saved.</div>
        )}
        {errors.form && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</div>
        )}

        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Student ID: <span className="font-mono font-semibold">{student.admissionNumber}</span> (not editable)
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={values.firstName} onChange={(v) => setField("firstName", v)} error={errors.firstName} required />
          <Field label="Last name" value={values.lastName} onChange={(v) => setField("lastName", v)} error={errors.lastName} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DualDateField label="Date of birth" name="dateOfBirth" value={values.dateOfBirth} onChange={(v) => setField("dateOfBirth", v)} error={errors.dateOfBirth} required />
          <SelectField
            label="Gender"
            value={values.gender}
            onChange={(v) => setField("gender", v)}
            error={errors.gender}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Class"
            value={values.classId}
            onChange={(v) => {
              setField("classId", v);
              setField("sectionId", "");
            }}
            error={errors.classId}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <SelectField
            label="Section"
            value={values.sectionId}
            onChange={(v) => setField("sectionId", v)}
            error={errors.sectionId}
            options={selectedClass?.sections.map((s) => ({ value: s.id, label: s.name })) ?? []}
            disabled={!selectedClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DualDateField label="Admission date" name="admissionDate" value={values.admissionDate} onChange={(v) => setField("admissionDate", v)} error={errors.admissionDate} required />
          <SelectField
            label="Status"
            value={values.status}
            onChange={(v) => setField("status", v)}
            error={errors.status}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "graduated", label: "Graduated" },
              { value: "transferred", label: "Transferred" },
            ]}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Guardian name" value={values.guardianName} onChange={(v) => setField("guardianName", v)} error={errors.guardianName} required />
          <Field label="Guardian phone" value={values.guardianPhone} onChange={(v) => setField("guardianPhone", v)} error={errors.guardianPhone} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Father's name" value={values.fatherName} onChange={(v) => setField("fatherName", v)} error={errors.fatherName} />
          <Field label="Mother's name" value={values.motherName} onChange={(v) => setField("motherName", v)} error={errors.motherName} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Guardian email" type="email" value={values.guardianEmail} onChange={(v) => setField("guardianEmail", v)} error={errors.guardianEmail} />
          <Field label="Address" value={values.address} onChange={(v) => setField("address", v)} error={errors.address} />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <h3 className="mb-1 text-sm font-semibold text-red-900">Danger zone</h3>
        <p className="mb-3 text-xs text-red-700">
          Deleting is only possible if this student has no fee history at all. If they do, use a
          status change instead - it preserves every invoice and payment on record.
        </p>

        {deleteError && (
          <div className="mb-3 rounded-md bg-white px-3 py-2 text-xs text-red-800">
            {deleteError.message}
            {deleteError.hasFinancialHistory && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleQuickStatus("transferred")}
                  disabled={isPending}
                  className="rounded-md border border-red-300 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-50"
                >
                  Mark transferred
                </button>
                <button
                  onClick={() => handleQuickStatus("inactive")}
                  disabled={isPending}
                  className="rounded-md border border-red-300 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-50"
                >
                  Mark inactive
                </button>
                <button
                  onClick={() => handleQuickStatus("graduated")}
                  disabled={isPending}
                  className="rounded-md border border-red-300 bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-50"
                >
                  Mark graduated
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Working..." : "Delete student"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className={`w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 ${
          error ? "border-red-300 focus:ring-red-100" : "border-slate-300 focus:ring-slate-100"
        }`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-red-300 focus:ring-red-100" : "border-slate-300 focus:ring-slate-100"
        }`}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
