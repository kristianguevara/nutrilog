import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatLocalDateIso, parseLocalDateIso, suggestionInputSnapshotSchema } from "@nutrilog/shared";
import type { MealType } from "@nutrilog/shared";
import { CoachAdviceSection } from "@/components/CoachAdviceSection.js";
import { ErrorBanner } from "@/components/ErrorBanner.js";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { formatDisplayDate, logItemCategoryLabel, mealLabel } from "@/lib/format.js";
import { useAppState } from "@/providers/AppStateProvider.js";
import { buildSuggestions } from "@/services/suggestionEngine.js";
import { groupByMeal, mealTotals, sumDayTotals } from "@/services/foodLogService.js";

function addDaysIso(iso: string, delta: number): string {
  const d = parseLocalDateIso(iso);
  d.setDate(d.getDate() + delta);
  return formatLocalDateIso(d);
}

export function TodayPage() {
  const {
    profile,
    entries,
    loadError,
    storageError,
    clearErrors,
    ready,
    recordSuggestionSnapshot,
    coachAdviceHistory,
    recordCoachAdvice,
  } = useAppState();
  const [params, setParams] = useSearchParams();
  const raw = params.get("date");
  const today = formatLocalDateIso(new Date());
  const selectedDate =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  function setSelectedDate(next: string) {
    setParams(next === today ? {} : { date: next });
  }

  const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  const grouped = groupByMeal(entries, selectedDate);
  const dayTotals = sumDayTotals(entries, selectedDate);
  const target = profile?.dailyCalorieTarget;
  const progress = target ? Math.min(1, dayTotals.calories / target) : null;

  const suggestions = useMemo(
    () => buildSuggestions(profile, entries, selectedDate),
    [profile, entries, selectedDate],
  );

  useEffect(() => {
    if (!ready) return;
    const totals = sumDayTotals(entries, selectedDate);
    const entryCount = entries.filter((e) => e.date === selectedDate).length;
    const inputSnapshot = suggestionInputSnapshotSchema.parse({
      dayCalories: totals.calories,
      dayProtein: totals.protein,
      dayCarbs: totals.carbs,
      dayFat: totals.fat,
      entryCount,
    });
    void recordSuggestionSnapshot({
      date: selectedDate,
      suggestions,
      inputSnapshot,
    });
  }, [ready, entries, selectedDate, recordSuggestionSnapshot, suggestions]);

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Today</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">
            Hi{profile?.nickname ? `, ${profile.nickname}` : ""}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{formatDisplayDate(selectedDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="min-h-10 px-3 py-2 text-xs"
              onClick={() => setSelectedDate(addDaysIso(selectedDate, -1))}
              aria-label="Previous day"
            >
              ←
            </Button>
            <Button
              variant="secondary"
              className="min-h-10 px-3 py-2 text-xs"
              onClick={() => setSelectedDate(addDaysIso(selectedDate, 1))}
              aria-label="Next day"
            >
              →
            </Button>
          </div>
          {selectedDate !== today ? (
            <button
              type="button"
              className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
              onClick={() => setSelectedDate(today)}
            >
              Jump to today
            </button>
          ) : null}
        </div>
      </header>

      {loadError ? (
        <div className="mb-4">
          <ErrorBanner message={loadError} onDismiss={clearErrors} />
        </div>
      ) : null}
      {storageError ? (
        <div className="mb-4">
          <ErrorBanner message={storageError} onDismiss={clearErrors} />
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Calories (estimate)
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-50">
              {Math.round(dayTotals.calories)}
              <span className="text-lg font-medium text-slate-500"> kcal</span>
            </p>
            {target ? (
              <p className="mt-2 text-sm text-slate-400">
                Target ~{Math.round(target)} kcal · remaining ~{Math.max(0, Math.round(target - dayTotals.calories))}{" "}
                kcal
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No daily target set — add one in Settings.</p>
            )}
          </div>
          {progress !== null ? (
            <div className="w-28">
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400/90"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs text-slate-500">{Math.round(progress * 100)}%</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-800/80 pt-5">
          <MacroStat label="Protein" value={dayTotals.protein} unit="g" />
          <MacroStat label="Carbs" value={dayTotals.carbs} unit="g" />
          <MacroStat label="Fat" value={dayTotals.fat} unit="g" />
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link to={`/food/new?date=${selectedDate}`} className="block">
          <Button className="w-full">🍽️ Add food</Button>
        </Link>
        <Link to={`/food/new?date=${selectedDate}&category=drink`} className="block">
          <Button className="w-full">🥤 Add drink</Button>
        </Link>
      </div>
      <Link to={`/scan?date=${selectedDate}`} className="mb-4 block">
        <Button className="w-full">📷 Scan meal</Button>
      </Link>

      {suggestions.length > 0 ? (
        <section className="mb-6 space-y-3" aria-label="Suggestions">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Suggestions</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Coaching-style tips from your log and profile — computed on this device. No AI calls; no API credits
              used.
            </p>
          </div>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <Card key={s.id} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{s.body}</p>
                <p className="mt-3 text-xs text-slate-500">Educational estimate — not medical advice.</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {profile ? (
        <CoachAdviceSection
          selectedDate={selectedDate}
          profile={profile}
          entries={entries}
          coachAdviceHistory={coachAdviceHistory}
          recordCoachAdvice={recordCoachAdvice}
        />
      ) : null}

      <section className="space-y-4" aria-label="Meals">
        {meals.map((meal) => {
          const list = grouped[meal];
          const mt = mealTotals(entries, selectedDate, meal);
          return (
            <Card key={meal}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-50">{mealLabel(meal)}</h2>
                  <p className="text-xs text-slate-500">
                    {Math.round(mt.calories)} kcal · P {Math.round(mt.protein)} · C {Math.round(mt.carbs)} · F{" "}
                    {Math.round(mt.fat)}
                  </p>
                </div>
                <Link to={`/food/new?date=${selectedDate}&meal=${meal}`}>
                  <Button variant="ghost" className="min-h-10 px-3 py-2 text-xs">
                    Add
                  </Button>
                </Link>
              </div>

              {list.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing logged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-slate-100">{e.foodName}</p>
                          {e.itemCategory === "drink" ? (
                            <span className="shrink-0 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200/95">
                              {logItemCategoryLabel(e.itemCategory)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {e.quantity} {e.unit} · {e.time} · {Math.round(e.calories)} kcal
                        </p>
                        {e.notes ? <p className="mt-1 text-xs text-slate-400">{e.notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Link to={`/food/${e.id}/edit`} className="text-xs font-semibold text-emerald-300">
                          Edit
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </section>

    </div>
  );
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-50">
        {Math.round(value)}
        <span className="text-xs font-medium text-slate-500"> {unit}</span>
      </p>
    </div>
  );
}
