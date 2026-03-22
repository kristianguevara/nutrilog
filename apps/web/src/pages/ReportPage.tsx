import { useMemo, useState } from "react";
import { compareIsoDate, parseLocalDateIso } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import { filterSuggestionHistoryInRange } from "@/lib/exportData.js";
import { useAppState } from "@/providers/AppStateProvider.js";
import { buildRangeReport, defaultLastNDaysInclusive } from "@/services/analyticsService.js";

export function ReportPage() {
  const { entries, profile, suggestionHistory } = useAppState();
  const [startDate, setStartDate] = useState(() => defaultLastNDaysInclusive(7).startDate);
  const [endDate, setEndDate] = useState(() => defaultLastNDaysInclusive(7).endDate);

  const rangeInvalid = compareIsoDate(startDate, endDate) > 0;

  const report = useMemo(() => {
    if (rangeInvalid) return null;
    return buildRangeReport(entries, startDate, endDate, profile?.dailyCalorieTarget);
  }, [entries, startDate, endDate, profile?.dailyCalorieTarget, rangeInvalid]);

  const historyInRange = useMemo(
    () => filterSuggestionHistoryInRange(suggestionHistory, startDate, endDate),
    [suggestionHistory, startDate, endDate],
  );

  const maxCal = Math.max(1, ...(report?.caloriesByDay.map((d) => d.calories) ?? [0]));

  const caloriesByDayNewestFirst = useMemo(() => {
    if (!report) return [];
    return [...report.caloriesByDay].sort((a, b) => compareIsoDate(b.date, a.date));
  }, [report]);

  function resetToDefaultSevenDays() {
    const d = defaultLastNDaysInclusive(7);
    setStartDate(d.startDate);
    setEndDate(d.endDate);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Reports</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Nutrition &amp; trends</h1>
        <p className="mt-2 text-sm text-slate-400">
          Default range is the <span className="text-slate-200">last 7 days</span>. Changing start or end updates the
          report <span className="text-slate-200">immediately</span> — no separate Apply button.
        </p>
      </header>

      <Card className="mb-4">
        <p className="text-sm font-semibold text-slate-100">Date range</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400" htmlFor="range-start">
              Start
              <RequiredMark />
            </label>
            <input
              id="range-start"
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={startDate}
              onChange={(ev) => setStartDate(ev.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400" htmlFor="range-end">
              End
              <RequiredMark />
            </label>
            <input
              id="range-end"
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={endDate}
              onChange={(ev) => setEndDate(ev.target.value)}
            />
          </div>
        </div>
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={resetToDefaultSevenDays}>
          Reset to last 7 days
        </Button>
        {rangeInvalid ? (
          <p className="mt-3 text-sm text-rose-300">Start date must be on or before end date.</p>
        ) : null}
      </Card>

      {report ? (
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average intake</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-50">
              {Math.round(report.avgCalories)}
              <span className="text-base font-medium text-slate-500"> kcal/day</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Across {report.dayCount} day(s) in range (days without entries count as 0 in the average).
            </p>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Macros (daily averages)</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3">
                <p className="text-xs text-slate-500">Protein</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{Math.round(report.avgProtein)}g</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3">
                <p className="text-xs text-slate-500">Carbs</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{Math.round(report.avgCarbs)}g</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3">
                <p className="text-xs text-slate-500">Fat</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{Math.round(report.avgFat)}g</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Calories by day</p>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1" aria-label="Calories chart">
              {caloriesByDayNewestFirst.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-xs text-slate-400">{shortLabel(d.date)}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400/80"
                      style={{ width: `${Math.round((d.calories / maxCal) * 100)}%` }}
                    />
                  </div>
                  <div className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-200">
                    {Math.round(d.calories)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highlights</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>
                Days logged: <span className="font-semibold text-slate-50">{report.daysLogged}</span>
              </li>
              {report.highestDay ? (
                <li>
                  Highest day:{" "}
                  <span className="font-semibold text-slate-50">
                    {shortLabel(report.highestDay.date)} ({Math.round(report.highestDay.calories)} kcal)
                  </span>
                </li>
              ) : null}
              {report.lowestDay ? (
                <li>
                  Lowest day (among days with calories):{" "}
                  <span className="font-semibold text-slate-50">
                    {shortLabel(report.lowestDay.date)} ({Math.round(report.lowestDay.calories)} kcal)
                  </span>
                </li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Insights</p>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-200">
            {report.insights.map((line, idx) => (
              <li key={`${idx}-${line.slice(0, 32)}`}>• {line}</li>
            ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">Not medical advice — for personal awareness only.</p>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggestion history</p>
            <p className="mt-2 text-sm text-slate-400">
              Snapshots of rule-based suggestions (with inputs) when you viewed the Today screen. Used for future
              analysis — not medical advice.
            </p>
            {historyInRange.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No snapshots in this range yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {historyInRange.map((snap) => (
                  <li
                    key={snap.id}
                    className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3 text-sm text-slate-200"
                  >
                    <p className="text-xs text-slate-500">
                      {shortLabel(snap.date)} · {new Date(snap.generatedAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Inputs (estimate): {Math.round(snap.inputSnapshot.dayCalories)} kcal · P{" "}
                      {Math.round(snap.inputSnapshot.dayProtein)} · C {Math.round(snap.inputSnapshot.dayCarbs)} · F{" "}
                      {Math.round(snap.inputSnapshot.dayFat)} · {snap.inputSnapshot.entryCount} entries
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {snap.suggestions.map((s) => (
                        <li key={s.id}>
                          <span className="font-semibold text-slate-100">{s.title}</span> — {s.body}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function shortLabel(isoDate: string): string {
  const d = parseLocalDateIso(isoDate);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
