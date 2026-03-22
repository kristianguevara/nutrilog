import { buildSevenDayReport } from "@/services/analyticsService.js";
import { Card } from "@/components/ui/Card.js";
import { useAppState } from "@/providers/AppStateProvider.js";
import { parseLocalDateIso } from "@nutrilog/shared";

export function ReportPage() {
  const { entries, profile } = useAppState();
  const end = new Date();
  const report = buildSevenDayReport(entries, end, profile?.dailyCalorieTarget);

  const maxCal = Math.max(1, ...report.caloriesByDay.map((d) => d.calories));

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Report</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Last 7 days</h1>
        <p className="mt-2 text-sm text-slate-400">
          A lightweight snapshot — all numbers are estimates from your log.
        </p>
      </header>

      <div className="space-y-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average intake</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-50">
            {Math.round(report.avgCalories)}
            <span className="text-base font-medium text-slate-500"> kcal/day</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">Based on all 7 days (days without entries count as 0).</p>
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
          <div className="mt-4 space-y-3" aria-label="Calories chart">
            {report.caloriesByDay.map((d) => (
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
            {report.insights.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">Not medical advice — for personal awareness only.</p>
        </Card>
      </div>
    </div>
  );
}

function shortLabel(isoDate: string): string {
  const d = parseLocalDateIso(isoDate);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
