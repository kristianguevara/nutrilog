import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GoalType } from "@nutrilog/shared";
import { compareIsoDate, userProfileDraftSchema } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import {
  buildExportBundle,
  downloadTextFile,
  exportBundleAsCsv,
  exportBundleAsJson,
  getEntryDateBounds,
} from "@/lib/exportData.js";
import { goalLabel } from "@/lib/format.js";
import { useAppState } from "@/providers/AppStateProvider.js";

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    profile,
    updateProfile,
    entries,
    suggestionHistory,
    coachAdviceHistory,
    isSupabase,
    session,
    signOut,
    importNutrilogJson,
  } = useAppState();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("maintain_weight");
  const [targetRaw, setTargetRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => getEntryDateBounds(entries), [entries]);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [mergeProfileFromImport, setMergeProfileFromImport] = useState(true);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname);
    setEmail(profile.email);
    setGoalType(profile.goalType);
    setTargetRaw(profile.dailyCalorieTarget ? String(profile.dailyCalorieTarget) : "");
  }, [profile]);

  useEffect(() => {
    if (isSupabase && session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [isSupabase, session?.user?.email]);

  useEffect(() => {
    if (bounds.min && bounds.max) {
      setExportStart(bounds.min);
      setExportEnd(bounds.max);
    } else {
      setExportStart("");
      setExportEnd("");
    }
  }, [bounds.min, bounds.max]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const targetNum = targetRaw.trim() === "" ? undefined : Number(targetRaw);
    const emailForParse = isSupabase && session?.user?.email ? session.user.email : email.trim();
    const parsed = userProfileDraftSchema.safeParse({
      nickname: nickname.trim(),
      email: emailForParse,
      goalType,
      dailyCalorieTarget:
        targetNum === undefined || Number.isNaN(targetNum) ? undefined : targetNum,
    });
    if (!parsed.success) {
      setError("Please check your inputs.");
      return;
    }
    await updateProfile(parsed.data);
  }

  async function onSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  function onImportFilePick(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    setImportFile(file ?? null);
    setImportError(null);
    setImportSuccess(null);
  }

  async function onImportData() {
    if (!importFile) return;
    setImportError(null);
    setImportSuccess(null);
    setImportBusy(true);
    try {
      const text = await importFile.text();
      const json = JSON.parse(text) as unknown;
      const result = await importNutrilogJson(json, { mergeProfile: mergeProfileFromImport });
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportSuccess("Import finished successfully. Your log and related data were updated.");
      setImportFile(null);
      if (importFileInputRef.current) importFileInputRef.current.value = "";
    } catch {
      setImportError("Could not read or parse that file.");
    } finally {
      setImportBusy(false);
    }
  }

  function runExport(kind: "json" | "csv") {
    setExportError(null);
    if (!exportStart || !exportEnd) {
      setExportError("Set both dates to export.");
      return;
    }
    if (compareIsoDate(exportStart, exportEnd) > 0) {
      setExportError("Start date must be on or before end date.");
      return;
    }
    const bundle = buildExportBundle(profile, entries, suggestionHistory, coachAdviceHistory, exportStart, exportEnd);
    const stamp = `${exportStart}_${exportEnd}`;
    if (kind === "json") {
      downloadTextFile(`nutrilog-export-${stamp}.json`, exportBundleAsJson(bundle), "application/json");
    } else {
      downloadTextFile(`nutrilog-export-${stamp}.csv`, exportBundleAsCsv(bundle), "text/csv;charset=utf-8");
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Profile</h1>
        <p className="mt-2 text-sm text-slate-400">
          {isSupabase
            ? "Profile and log are stored in your Supabase project (PostgreSQL)."
            : "Everything stays on this device for the MVP."}
        </p>
      </header>

      <Card className="mb-4">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="snickname">
              Nickname
              <RequiredMark />
            </label>
            <input
              id="snickname"
              name="nickname"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="semail">
              Email
              <RequiredMark />
            </label>
            <input
              id="semail"
              name="email"
              type="email"
              readOnly={isSupabase}
              className={`mt-2 w-full rounded-xl border border-slate-800 px-3 py-3 text-sm outline-none ring-emerald-500/30 focus:ring-2 ${
                isSupabase
                  ? "cursor-not-allowed bg-slate-900/80 text-slate-400"
                  : "bg-slate-950 text-slate-100"
              }`}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
            {isSupabase ? (
              <p className="mt-2 text-xs text-slate-500">Email is your account identifier (Supabase Auth).</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="sgoal">
              Goal
              <RequiredMark />
            </label>
            <select
              id="sgoal"
              name="goalType"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={goalType}
              onChange={(ev) => setGoalType(ev.target.value as GoalType)}
            >
              {(["lose_weight", "maintain_weight", "gain_weight"] as const).map((g) => (
                <option key={g} value={g}>
                  {goalLabel(g)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="starget">
              Daily calorie target (optional)
            </label>
            <input
              id="starget"
              name="target"
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={targetRaw}
              onChange={(ev) => setTargetRaw(ev.target.value)}
              placeholder="e.g. 2200"
            />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
      </Card>

      {isSupabase ? (
        <Card className="mb-4">
          <p className="text-sm font-semibold text-slate-100">Import backup</p>
          <p className="mt-2 text-sm text-slate-400">
            Restore a <span className="text-slate-300">nutrilog-export</span> JSON file. The export&apos;s{" "}
            <span className="text-slate-300">user.email</span> must match your signed-in account. Existing rows with the
            same IDs are updated.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={mergeProfileFromImport}
              onChange={(ev) => setMergeProfileFromImport(ev.target.checked)}
              disabled={importBusy}
            />
            Also merge nickname, goal, and calorie target from the file
          </label>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400" htmlFor="import-json-file">
                JSON file
              </label>
              <input
                id="import-json-file"
                ref={importFileInputRef}
                type="file"
                accept="application/json,.json"
                className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-200"
                disabled={importBusy}
                onChange={onImportFilePick}
              />
              {importFile ? (
                <p className="mt-2 text-xs text-slate-500">Selected: {importFile.name}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Choose a file, then tap Import data.</p>
              )}
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={!importFile || importBusy}
              onClick={() => void onImportData()}
            >
              {importBusy ? "Importing…" : "Import data"}
            </Button>
          </div>
          {importSuccess ? (
            <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100/90">
              {importSuccess}
            </p>
          ) : null}
          {importError ? <p className="mt-3 text-sm text-rose-300">{importError}</p> : null}
        </Card>
      ) : null}

      <Card className="mb-4">
        <p className="text-sm font-semibold text-slate-100">Download report</p>
        <p className="mt-2 text-sm text-slate-400">
          Exports use a versioned <span className="text-slate-300">nutrilog-export</span> format: profile (nickname,
          email, goals), all food log fields (including IDs and AI metadata), and suggestion snapshots — suitable for
          spreadsheets, SQL, or future sync.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400" htmlFor="export-start">
              From
              <RequiredMark />
            </label>
            <input
              id="export-start"
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={exportStart}
              onChange={(ev) => setExportStart(ev.target.value)}
              disabled={!bounds.min}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400" htmlFor="export-end">
              To
              <RequiredMark />
            </label>
            <input
              id="export-end"
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={exportEnd}
              onChange={(ev) => setExportEnd(ev.target.value)}
              disabled={!bounds.max}
            />
          </div>
        </div>
        {exportError ? <p className="mt-3 text-sm text-rose-300">{exportError}</p> : null}
        {!bounds.min ? (
          <p className="mt-3 text-sm text-slate-500">Log at least one food entry to enable export.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" className="w-full" onClick={() => runExport("json")}>
              JSON
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => runExport("csv")}>
              CSV
            </Button>
          </div>
        )}
      </Card>

      {isSupabase ? (
        <Card className="mb-4">
          <p className="text-sm font-semibold text-slate-100">Account</p>
          <p className="mt-2 text-sm text-slate-400">Sign out on this device. Your data stays in the database.</p>
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => void onSignOut()}>
            Sign out
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
