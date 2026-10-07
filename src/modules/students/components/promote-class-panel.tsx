"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStudentsForPromotion } from "../actions/promotion-preview";
import { promoteStudents } from "../actions/promote-students";
import { suggestNextClass } from "../lib/promotion";

type ClassOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

type PreviewStudent = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  sectionName?: string;
};

export function PromoteClassPanel({
  schoolId,
  classes,
  onClose,
}: {
  schoolId: string;
  classes: ClassOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fromClassId, setFromClassId] = useState("");
  const [fromSectionId, setFromSectionId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [toSectionId, setToSectionId] = useState("");
  const [updateFeeRates, setUpdateFeeRates] = useState(true);

  const [previewStudents, setPreviewStudents] = useState<PreviewStudent[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ promoted: number; feeAssignmentsUpdated: number } | null>(null);
  const [error, setError] = useState("");

  const fromClass = classes.find((c) => c.id === fromClassId);
  const toClass = classes.find((c) => c.id === toClassId);

  // Suggest the next class the moment a source class is picked - still
  // fully editable, this is just a starting point for the common case.
  useEffect(() => {
    if (fromClassId && !toClassId) {
      const suggestion = suggestNextClass(classes, fromClassId);
      if (suggestion) setToClassId(suggestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromClassId]);

  function loadPreview() {
    if (!fromClassId) {
      setError("Select a class to promote from");
      return;
    }
    setError("");
    startTransition(async () => {
      const list = await getStudentsForPromotion(schoolId, fromClassId, fromSectionId || undefined);
      const rows = list.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.admissionNumber,
        sectionName: s.section?.name,
      }));
      setPreviewStudents(rows);
      setSelectedIds(new Set(rows.map((r) => r.id))); // everyone selected by default
    });
  }

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePromote() {
    if (!toClassId) {
      setError("Select a class to promote to");
      return;
    }
    if (selectedIds.size === 0) {
      setError("No students selected");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await promoteStudents(Array.from(selectedIds), toClassId, toSectionId || undefined, updateFeeRates);
      setResult(res);
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {result.promoted} student(s) promoted to {toClass?.name}
          {toSectionId ? `-${toClass?.sections.find((s) => s.id === toSectionId)?.name}` : ""}.
          {updateFeeRates && ` ${result.feeAssignmentsUpdated} fee assignment(s) updated to the new class rate.`}
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">From</p>
          <select
            value={fromClassId}
            onChange={(e) => {
              setFromClassId(e.target.value);
              setFromSectionId("");
              setPreviewStudents(null);
            }}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Select class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={fromSectionId}
            onChange={(e) => {
              setFromSectionId(e.target.value);
              setPreviewStudents(null);
            }}
            disabled={!fromClass}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
          >
            <option value="">All sections</option>
            {fromClass?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">To</p>
          <select
            value={toClassId}
            onChange={(e) => {
              setToClassId(e.target.value);
              setToSectionId("");
            }}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Select class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={toSectionId}
            onChange={(e) => setToSectionId(e.target.value)}
            disabled={!toClass}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
          >
            <option value="">No section</option>
            {toClass?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!previewStudents && (
        <button
          onClick={loadPreview}
          disabled={isPending || !fromClassId}
          className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Show students"}
        </button>
      )}

      {previewStudents && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {selectedIds.size} of {previewStudents.length} selected — uncheck anyone being held back
            </p>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSelectedIds(new Set(previewStudents.map((s) => s.id)))} className="text-slate-900 underline">
                Select all
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-slate-900 underline">
                Select none
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
            {previewStudents.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No active students found there.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <tbody>
                  {previewStudents.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleStudent(s.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">{s.admissionNumber}</td>
                      <td className="px-3 py-2 text-slate-500">{s.sectionName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={updateFeeRates} onChange={(e) => setUpdateFeeRates(e.target.checked)} />
            Also update recurring fee amounts (monthly/termly/annual) to the new class&apos;s rates going forward.
            One-time fees already invoiced are never affected.
          </label>

          <div className="flex gap-3">
            <button
              onClick={handlePromote}
              disabled={isPending || selectedIds.size === 0}
              className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isPending ? "Promoting..." : `Promote ${selectedIds.size} student(s)`}
            </button>
            <button onClick={() => setPreviewStudents(null)} className="text-sm text-slate-500 hover:text-slate-700">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
