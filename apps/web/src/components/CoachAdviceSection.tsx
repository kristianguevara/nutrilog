import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CoachAdvice, CoachAdviceInputSnapshot, FoodLogEntry, UserProfile } from "@nutrilog/shared";
import { coachAdviceInputSnapshotSchema } from "@nutrilog/shared";
import { CoachMessageMarkdown } from "@/components/CoachMessageMarkdown.js";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { requestCoachAdvice } from "@/services/coachAdviceService.js";
import { buildCoachRequest } from "@/services/coachAdviceMapping.js";
import { filterEntriesForDate, sumDayTotals } from "@/services/foodLogService.js";

const MAX_PER_DAY = 2;

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CoachAdviceSection(props: {
  selectedDate: string;
  profile: UserProfile;
  entries: FoodLogEntry[];
  coachAdviceHistory: CoachAdvice[];
  recordCoachAdvice: (input: {
    date: string;
    sequence: 1 | 2;
    inputSnapshot: CoachAdviceInputSnapshot;
    summary: string;
  }) => void;
}) {
  const { selectedDate, profile, entries, coachAdviceHistory, recordCoachAdvice } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const dayEntries = useMemo(
    () => filterEntriesForDate(entries, selectedDate),
    [entries, selectedDate],
  );

  const forDay = useMemo(() => {
    return coachAdviceHistory
      .filter((c) => c.date === selectedDate)
      .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
  }, [coachAdviceHistory, selectedDate]);

  useEffect(() => {
    if (forDay.length === 0) {
      setSlideIndex(0);
      return;
    }
    setSlideIndex(forDay.length - 1);
  }, [selectedDate, forDay.length]);

  const coachCount = forDay.length;
  const canAsk = dayEntries.length >= 1 && coachCount < MAX_PER_DAY;
  const remaining = MAX_PER_DAY - coachCount;

  let statusLine: ReactNode = null;
  if (dayEntries.length === 0) {
    statusLine = <p className="text-xs text-slate-500">Log at least one food or drink for this day to ask the coach.</p>;
  } else if (coachCount >= MAX_PER_DAY) {
    statusLine = (
      <p className="text-xs text-amber-200/90">
        Daily limit reached ({MAX_PER_DAY} coach messages for {selectedDate}).
      </p>
    );
  } else if (canAsk) {
    statusLine = (
      <p className="text-xs text-slate-500">
        {remaining} of {MAX_PER_DAY} remaining today for this date.
      </p>
    );
  }

  async function onAskCoach() {
    setError(null);
    if (!canAsk || loading) return;
    const totals = sumDayTotals(entries, selectedDate);
    const entryCount = dayEntries.length;
    const sequence = (coachCount + 1) as 1 | 2;
    const inputSnapshot = coachAdviceInputSnapshotSchema.parse({
      dayCalories: totals.calories,
      dayProtein: totals.protein,
      dayCarbs: totals.carbs,
      dayFat: totals.fat,
      entryCount,
    });

    const body = buildCoachRequest({
      date: selectedDate,
      coachInsightNumber: sequence,
      profile,
      dayTotals: totals,
      entries: dayEntries,
    });

    setLoading(true);
    try {
      const { summary } = await requestCoachAdvice(body);
      await recordCoachAdvice({ date: selectedDate, sequence, inputSnapshot, summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach request failed.");
    } finally {
      setLoading(false);
    }
  }

  const active = forDay[slideIndex];
  const hasMultiple = forDay.length > 1;

  return (
    <section className="mb-6 space-y-3" aria-label="AI coach">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">AI coach</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          One comprehensive LLM insight per tap (same API keys as scan / auto-fill). Max {MAX_PER_DAY} per day for
          this calendar date. Saved for export and analysis.
        </p>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!canAsk || loading}
        onClick={() => void onAskCoach()}
      >
        {loading ? "Asking coach…" : "Ask AI Coach"}
      </Button>

      {statusLine}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {forDay.length > 0 ? (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
              Saved coach message
              {hasMultiple ? ` (${slideIndex + 1} / ${forDay.length})` : null}
            </p>
            {hasMultiple ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 min-w-9 px-0 py-0 text-lg"
                  aria-label="Previous coach message"
                  onClick={() => setSlideIndex((i) => (i <= 0 ? forDay.length - 1 : i - 1))}
                >
                  ‹
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 min-w-9 px-0 py-0 text-lg"
                  aria-label="Next coach message"
                  onClick={() => setSlideIndex((i) => (i >= forDay.length - 1 ? 0 : i + 1))}
                >
                  ›
                </Button>
              </div>
            ) : null}
          </div>
          {active ? (
            <>
              <p className="mt-2 text-sm text-slate-400">
                {active.sequence === 1 ? "First" : "Second"} of the day · {formatGeneratedAt(active.generatedAt)}
              </p>
              <div className="coach-advice-md mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
                <CoachMessageMarkdown text={active.summary} />
              </div>
            </>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">Educational coaching — not medical advice.</p>
        </Card>
      ) : null}
    </section>
  );
}
