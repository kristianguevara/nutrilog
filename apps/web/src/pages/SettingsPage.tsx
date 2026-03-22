import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GoalType } from "@nutrilog/shared";
import { userProfileDraftSchema } from "@nutrilog/shared";
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
import { compareIsoDate } from "@nutrilog/shared";

export function SettingsPage() {
  const navigate = useNavigate();
  const { profile, updateProfile, resetAll, entries, suggestionHistory } = useAppState();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("maintain_weight");
  const [targetRaw, setTargetRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => getEntryDateBounds(entries), [entries]);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname);
    setEmail(profile.email);
    setGoalType(profile.goalType);
    setTargetRaw(profile.dailyCalorieTarget ? String(profile.dailyCalorieTarget) : "");
  }, [profile]);

  useEffect(() => {
    if (bounds.min && bounds.max) {
      setExportStart(bounds.min);
      setExportEnd(bounds.max);
    } else {
      setExportStart("");
      setExportEnd("");
    }
  }, [bounds.min, bounds.max]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const targetNum = targetRaw.trim() === "" ? undefined : Number(targetRaw);
    const parsed = userProfileDraftSchema.safeParse({
      nickname: nickname.trim(),
      email: email.trim(),
      goalType,
      dailyCalorieTarget:
        targetNum === undefined || Number.isNaN(targetNum) ? undefined : targetNum,
    });
    if (!parsed.success) {
      setError("Please check your inputs.");
      return;
    }
    updateProfile(parsed.data);
  }

  function onReset() {
    if (!window.confirm("This clears all NutriLog data on this device. Continue?")) return;
    resetAll();
    navigate("/onboarding", { replace: true });
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
    const bundle = buildExportBundle(profile, entries, suggestionHistory, exportStart, exportEnd);
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
        <p className="mt-2 text-sm text-slate-400">Everything stays on this device for the MVP.</p>
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
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
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

      <Card className="mb-4">
        <p className="text-sm font-semibold text-slate-100">Download report</p>
        <p className="mt-2 text-sm text-slate-400">
          Export food entries and suggestion snapshots for a date range (defaults span your first to last logged day).
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

      <Card>
        <p className="text-sm font-semibold text-slate-100">Danger zone</p>
        <p className="mt-2 text-sm text-slate-400">Clear all local NutriLog data and return to onboarding.</p>
        <Button type="button" variant="danger" className="mt-4 w-full" onClick={onReset}>
          Clear all local data
        </Button>
      </Card>
    </div>
  );
}
