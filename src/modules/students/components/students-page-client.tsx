"use client";

import { useState } from "react";
import { AddStudentForm } from "./add-student-form";
import { ImportWizard } from "./import-wizard";
import { EditStudentForm } from "./edit-student-form";
import { PromoteClassPanel } from "./promote-class-panel";

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
  className?: string;
  sectionName?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  fatherName: string | null;
  motherName: string | null;
  address: string | null;
  admissionDate: string;
  status: string;
};

export function StudentsPageClient({
  schoolId,
  classes,
  students,
}: {
  schoolId: string;
  classes: ClassOption[];
  students: StudentRow[];
}) {
  const [panel, setPanel] = useState<"none" | "add" | "import" | "promote">("none");
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">
            {students.length} {students.length === 1 ? "student" : "students"} enrolled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToolbarButton
            active={panel === "import"}
            onClick={() => setPanel(panel === "import" ? "none" : "import")}
            icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 9l5-5 5 5M12 4v12"
          >
            Import
          </ToolbarButton>
          <ToolbarButton
            active={panel === "promote"}
            onClick={() => setPanel(panel === "promote" ? "none" : "promote")}
            icon="M13 7l5 5m0 0l-5 5m5-5H6"
          >
            Promote class
          </ToolbarButton>
          <ToolbarButton
            primary
            active={panel === "add"}
            onClick={() => setPanel(panel === "add" ? "none" : "add")}
            icon="M12 4v16m8-8H4"
          >
            Add student
          </ToolbarButton>
        </div>
      </div>

      {panel === "add" && (
        <Panel title="Add student" onClose={() => setPanel("none")}>
          <AddStudentForm classes={classes} onSuccess={() => setPanel("none")} />
        </Panel>
      )}

      {panel === "import" && (
        <Panel title="Import students" onClose={() => setPanel("none")}>
          <ImportWizard schoolId={schoolId} />
        </Panel>
      )}

      {panel === "promote" && (
        <Panel title="Promote class" onClose={() => setPanel("none")}>
          <PromoteClassPanel schoolId={schoolId} classes={classes} onClose={() => setPanel("none")} />
        </Panel>
      )}

      {editingStudent && (
        <Panel title={`Edit ${editingStudent.firstName} ${editingStudent.lastName}`} onClose={() => setEditingStudent(null)}>
          <EditStudentForm student={editingStudent} classes={classes} onClose={() => setEditingStudent(null)} />
        </Panel>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Student ID</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Class</th>
              <th className="px-4 py-2.5 font-medium">Guardian</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.admissionNumber}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {s.className}
                  {s.sectionName ? `-${s.sectionName}` : ""}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{s.guardianName}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.guardianPhone}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => setEditingStudent(s)}
                    className="text-xs font-medium text-slate-900 underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No students yet — add one manually or import a spreadsheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  primary,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
  icon: string;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const style = primary
    ? active
      ? "bg-slate-700 text-white"
      : "bg-slate-900 text-white hover:bg-slate-700"
    : active
    ? "bg-slate-100 text-slate-900 border border-slate-300"
    : "border border-slate-300 text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} className={`${base} ${style}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {children}
    </button>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    inactive: "bg-slate-100 text-slate-600",
    graduated: "bg-blue-50 text-blue-700",
    transferred: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
