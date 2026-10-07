"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStudentAction } from "../actions/add-student.action";
import { DualDateField } from "@/components/dual-date-field";

type ClassOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

const BLANK_FORM = {
  admissionDate: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  classId: "",
  sectionId: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  fatherName: "",
  motherName: "",
  address: "",
};

export function AddStudentForm({
  classes,
  onSuccess,
}: {
  classes: ClassOption[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fully controlled state for every field - deliberate: values live
  // here, not in the DOM, so a failed submission (missing guardian phone,
  // whatever) can never wipe out what was typed. Only a confirmed
  // success clears it.
  const [values, setValues] = useState(BLANK_FORM);

  const selectedClass = classes.find((c) => c.id === values.classId);

  function setField(name: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneratedId(null);
    const formData = new FormData();
    for (const [key, val] of Object.entries(values)) {
      formData.set(key, val);
    }
    startTransition(async () => {
      const result = await addStudentAction(formData);
      if (result.success) {
        setErrors({});
        setGeneratedId(result.generatedStudentCode);
        setValues(BLANK_FORM);
        router.refresh();
        onSuccess?.();
      } else {
        // Deliberately do NOT touch `values` here - everything the admin
        // typed stays exactly as it was so they only need to fix the
        // flagged field(s), not re-enter the whole form.
        setErrors(result.errors);
      }
    });
  }

  return (
    <form id="add-student-form" onSubmit={handleSubmit} className="space-y-4">
      {generatedId && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Student added — Student ID <span className="font-mono font-semibold">{generatedId}</span>
        </div>
      )}
      {errors.form && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</div>
      )}

      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Student ID is generated automatically once saved — no need to enter one.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          value={values.firstName}
          onChange={(v) => setField("firstName", v)}
          error={errors.firstName}
          required
        />
        <Field
          label="Last name"
          value={values.lastName}
          onChange={(v) => setField("lastName", v)}
          error={errors.lastName}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DualDateField
          label="Date of birth"
          name="dateOfBirth"
          value={values.dateOfBirth}
          onChange={(v) => setField("dateOfBirth", v)}
          error={errors.dateOfBirth}
          required
        />
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
        <DualDateField
          label="Admission date"
          name="admissionDate"
          value={values.admissionDate}
          onChange={(v) => setField("admissionDate", v)}
          error={errors.admissionDate}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Guardian name"
          value={values.guardianName}
          onChange={(v) => setField("guardianName", v)}
          error={errors.guardianName}
          required
        />
        <Field
          label="Guardian phone"
          value={values.guardianPhone}
          onChange={(v) => setField("guardianPhone", v)}
          error={errors.guardianPhone}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Father's name (optional)"
          value={values.fatherName}
          onChange={(v) => setField("fatherName", v)}
          error={errors.fatherName}
        />
        <Field
          label="Mother's name (optional)"
          value={values.motherName}
          onChange={(v) => setField("motherName", v)}
          error={errors.motherName}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Guardian email"
          type="email"
          value={values.guardianEmail}
          onChange={(v) => setField("guardianEmail", v)}
          error={errors.guardianEmail}
        />
        <Field
          label="Address"
          value={values.address}
          onChange={(v) => setField("address", v)}
          error={errors.address}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save student"}
      </button>
    </form>
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
