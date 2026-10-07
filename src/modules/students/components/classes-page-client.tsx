"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClass, createSection, deleteClass, deleteSection } from "../actions/manage-classes";

type SectionRow = { id: string; name: string; studentCount: number };
type ClassRow = { id: string; name: string; studentCount: number; sections: SectionRow[] };

export function ClassesPageClient({
  schoolId,
  academicYearId,
  academicYearName,
  classes,
}: {
  schoolId: string;
  academicYearId: string;
  academicYearName?: string;
  classes: ClassRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newClassName, setNewClassName] = useState("");
  const [error, setError] = useState("");
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");

  function handleAddClass() {
    if (!academicYearId) {
      setError("No current academic year found - set one up before adding classes.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createClass(schoolId, academicYearId, newClassName);
      if (result.success) {
        setNewClassName("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleAddSection(classId: string) {
    setError("");
    startTransition(async () => {
      const result = await createSection(classId, newSectionName);
      if (result.success) {
        setNewSectionName("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDeleteClass(classId: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteClass(classId);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function handleDeleteSection(sectionId: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteSection(sectionId);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Classes</h1>
        <p className="text-sm text-slate-500">
          {academicYearName ? `Academic year: ${academicYearName}` : "No current academic year set"}
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">New class name</span>
          <input
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g. Grade 6, Class VI, Nursery"
            className="w-64 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={handleAddClass}
          disabled={isPending || !newClassName.trim()}
          className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Add class
        </button>
      </div>

      <div className="space-y-3">
        {classes.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div>
                <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                <span className="ml-2 text-xs text-slate-400">{c.studentCount} student(s)</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  onClick={() => setExpandedClassId(expandedClassId === c.id ? null : c.id)}
                  className="font-medium text-slate-900 underline"
                >
                  {expandedClassId === c.id ? "Hide" : "Manage sections"}
                </button>
                {c.studentCount === 0 && (
                  <button onClick={() => handleDeleteClass(c.id)} disabled={isPending} className="text-red-600 underline">
                    Delete class
                  </button>
                )}
              </div>
            </div>

            {expandedClassId === c.id && (
              <div className="space-y-2 bg-slate-50 px-4 py-3">
                {c.sections.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">
                      Section {s.name} <span className="text-slate-400">({s.studentCount} student(s))</span>
                    </span>
                    {s.studentCount === 0 && (
                      <button onClick={() => handleDeleteSection(s.id)} disabled={isPending} className="text-red-600 underline">
                        Delete
                      </button>
                    )}
                  </div>
                ))}
                {c.sections.length === 0 && <p className="text-xs text-slate-400">No sections yet.</p>}

                <div className="flex items-end gap-2 pt-2">
                  <input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g. A, B, Blue"
                    className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => handleAddSection(c.id)}
                    disabled={isPending || !newSectionName.trim()}
                    className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Add section
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {classes.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
            No classes yet — add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
