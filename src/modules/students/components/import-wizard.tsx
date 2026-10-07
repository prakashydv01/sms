"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseImportFile, type ParsedSheet } from "../actions/parse-import-file";
import { validateImportRows, type ImportRowResult } from "../actions/validate-import-rows";
import { commitImport, type CommitImportResult } from "../actions/commit-import";
import { autoDetectMapping, IMPORT_TARGET_FIELDS } from "../lib/column-mapping";

type Step = "upload" | "map" | "preview" | "done";

export function ImportWizard({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [nameMode, setNameMode] = useState<"separate" | "full">("separate");
  const [rows, setRows] = useState<ImportRowResult[]>([]);
  const [summary, setSummary] = useState({ ok: 0, warning: 0, error: 0 });
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [result, setResult] = useState<CommitImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await parseImportFile(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSheet(res.sheet);
      const detected = autoDetectMapping(res.sheet.headers);
      setMapping(detected);
      // If we auto-detected a Full Name column but no separate first/last,
      // default the mode to match what the file actually looks like.
      setNameMode(detected.fullName && !detected.firstName && !detected.lastName ? "full" : "separate");
      setStep("map");
    });
  }

  // Fields shown in the mapping UI depend on nameMode: never show both
  // "Full Name" and "First/Last Name" at once, since only one is used.
  const visibleFields = IMPORT_TARGET_FIELDS.filter((f) => {
    if (f.key === "fullName") return nameMode === "full";
    if (f.key === "firstName" || f.key === "lastName") return nameMode === "separate";
    return true;
  });

  function runValidation() {
    if (!sheet) return;
    const nameRequirementMet =
      nameMode === "full" ? !!mapping.fullName : !!mapping.firstName && !!mapping.lastName;
    const missingRequired = visibleFields.filter((f) => f.required && !mapping[f.key]);
    if (!nameRequirementMet) {
      setError(
        nameMode === "full"
          ? "Please map the Full Name column"
          : "Please map both First Name and Last Name columns"
      );
      return;
    }
    if (missingRequired.length > 0) {
      setError(`Please map all required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await validateImportRows(schoolId, sheet.rows, mapping);
      setRows(res.results);
      setSummary(res.summary);
      setStep("preview");
    });
  }

  function handleCommit() {
    startTransition(async () => {
      const res = await commitImport(schoolId, fileName, rows);
      setResult(res);
      setStep("done");
      router.refresh();
    });
  }

  const visibleRows = showErrorsOnly ? rows.filter((r) => r.status !== "ok") : rows;
  const extraFieldHeaders = [...new Set(rows.flatMap((r) => Object.keys(r.extraFields ?? {})))];

  return (
    <div className="space-y-5">
      <Stepper current={step} />

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {step === "upload" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Upload a .xlsx, .xls, or .csv file. Column headers don&apos;t need to match our
            field names exactly — you&apos;ll map them in the next step. Starting from
            scratch?{" "}
            <a
              href="/templates/student-import-template.csv"
              download
              className="font-medium text-slate-900 underline"
            >
              Download a template
            </a>
            .
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={isPending}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3.5 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
          {isPending && <p className="text-sm text-slate-400">Reading file...</p>}
        </div>
      )}

      {step === "map" && sheet && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            We auto-matched what we could from <span className="font-medium">{fileName}</span> (
            {sheet.rows.length} rows). Review and adjust any mapping below.
          </p>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Name columns in your file</span>
            <div className="flex rounded-md border border-slate-300 p-0.5 text-xs w-fit">
              <button
                onClick={() => setNameMode("separate")}
                className={`rounded px-3 py-1.5 font-medium ${
                  nameMode === "separate" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                Separate first & last name
              </button>
              <button
                onClick={() => setNameMode("full")}
                className={`rounded px-3 py-1.5 font-medium ${
                  nameMode === "full" ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >
                One full name column
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {visibleFields.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </span>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">-- Don&apos;t import --</option>
                  {sheet.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Any column you don&apos;t map above (e.g. &quot;Blood Group&quot;, &quot;Previous School&quot;) is still
            saved with the student, just not shown in the main tables yet.
          </p>
          <button
            onClick={runValidation}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Validating..." : "Validate & preview"}
          </button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Badge color="green">{summary.ok} ready</Badge>
            <Badge color="yellow">{summary.warning} warnings</Badge>
            <Badge color="red">{summary.error} errors</Badge>
            <label className="ml-auto flex items-center gap-2 text-slate-500">
              <input
                type="checkbox"
                checked={showErrorsOnly}
                onChange={(e) => setShowErrorsOnly(e.target.checked)}
              />
              Show only errors/warnings
            </label>
          </div>

          <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Name (as will be saved)</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Issue</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className={`border-b border-slate-100 ${
                      r.status === "error" ? "bg-red-50" : r.status === "warning" ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{r.rowNumber}</td>
                    <td className="px-3 py-2 capitalize">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.data.firstName || <span className="text-slate-300">—</span>}
                      {r.data.lastName ? ` ${r.data.lastName}` : ""}
                    </td>
                    <td className="px-3 py-2">{r.data.classId ? "✓" : r.data.className || "—"}</td>
                    <td className="px-3 py-2 text-red-700">
                      {[...Object.values(r.errors), ...Object.values(r.warnings)].join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {extraFieldHeaders.length > 0 && (
            <p className="text-xs text-slate-400">
              Extra column(s) not mapped to a known field will still be saved with each student:{" "}
              <span className="font-medium text-slate-600">{extraFieldHeaders.join(", ")}</span>
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleCommit}
              disabled={isPending || summary.ok + summary.warning === 0}
              className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isPending
                ? "Importing..."
                : `Import ${summary.ok + summary.warning} valid row(s)`}
            </button>
            <button
              onClick={() => setStep("map")}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Back to mapping
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Rows with errors are skipped automatically — fix them in your source file and
            re-upload separately if needed.
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-3">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Import complete: {result.successRows} of {result.totalRows} rows imported.
          </div>
          {result.failures.length > 0 && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="mb-1 font-medium">{result.failures.length} row(s) failed at save time:</p>
              <ul className="list-inside list-disc">
                {result.failures.map((f) => (
                  <li key={f.rowNumber}>
                    Row {f.rowNumber}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload" },
    { key: "map", label: "2. Map columns" },
    { key: "preview", label: "3. Validate & preview" },
    { key: "done", label: "4. Done" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex gap-2 text-xs">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={`rounded-full px-3 py-1 ${
            i === currentIndex
              ? "bg-slate-900 text-white"
              : i < currentIndex
              ? "bg-slate-200 text-slate-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "yellow" | "red"; children: React.ReactNode }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    yellow: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-3 py-1 font-medium ${colors[color]}`}>{children}</span>;
}
