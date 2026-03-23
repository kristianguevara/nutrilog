import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CoachAdvice, CoachAdviceInputSnapshot, FoodLogEntry, UserProfile } from "@nutrilog/shared";
import { coachAdviceInputSnapshotSchema } from "@nutrilog/shared";
import { formatLocalDateIso, parseLocalDateIso } from "@nutrilog/shared";
import { CoachMessageMarkdown } from "@/components/CoachMessageMarkdown.js";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { requestCoachAdvice } from "@/services/coachAdviceService.js";
import { buildCoachPromptText, buildCoachRequest } from "@/services/coachAdviceMapping.js";
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
    sequence: number;
    inputSnapshot: CoachAdviceInputSnapshot;
    summary: string;
  }) => Promise<void>;
}) {
  const { selectedDate, profile, entries, coachAdviceHistory, recordCoachAdvice } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");
  const [thirdPartySummary, setThirdPartySummary] = useState("");
  const [thirdPartyState, setThirdPartyState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [thirdPartyError, setThirdPartyError] = useState<string | null>(null);

  const dayEntries = useMemo(
    () => filterEntriesForDate(entries, selectedDate),
    [entries, selectedDate],
  );

  const recentDays = useMemo(() => {
    const dates: string[] = [];
    const selected = parseLocalDateIso(selectedDate);
    for (let delta = 6; delta >= 0; delta -= 1) {
      const d = new Date(selected);
      d.setDate(d.getDate() - delta);
      dates.push(formatLocalDateIso(d));
    }
    return dates.map((date) => ({
      date,
      dayTotals: sumDayTotals(entries, date),
      entries: filterEntriesForDate(entries, date),
    }));
  }, [entries, selectedDate]);

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

  const internalCoachCount = forDay.filter((c) => c.sequence <= MAX_PER_DAY).length;
  const canAsk = dayEntries.length >= 1 && internalCoachCount < MAX_PER_DAY;
  const remaining = MAX_PER_DAY - internalCoachCount;
  const nextThirdPartySequence = Math.max(2, ...forDay.map((c) => c.sequence)) + 1;

  let statusLine: ReactNode = null;
  if (dayEntries.length === 0) {
    statusLine = <p className="text-xs text-slate-500">Log at least one food or drink for this day to ask the coach.</p>;
  } else if (internalCoachCount >= MAX_PER_DAY) {
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

  function buildRequestForInternalCoach(sequence: 1 | 2) {
    return buildCoachRequest({
      date: selectedDate,
      coachInsightNumber: sequence,
      profile,
      dayTotals: sumDayTotals(entries, selectedDate),
      entries: dayEntries,
      recentDays,
    });
  }

  async function onCopyPrompt() {
    setCopyState("idle");
    if (!canAsk || loading) return;
    const sequence = (internalCoachCount + 1) as 1 | 2;
    const body = buildRequestForInternalCoach(sequence);
    const promptText = buildCoachPromptText(body);
    try {
      await navigator.clipboard.writeText(promptText);
      setCopyState("ok");
    } catch {
      setCopyState("error");
    }
  }

  async function onSaveThirdPartyCoach() {
    setThirdPartyError(null);
    if (thirdPartyState === "saving") return;
    const summary = thirdPartySummary.trim();
    if (!summary) {
      setThirdPartyError("Paste a third-party coach result before saving.");
      setThirdPartyState("error");
      return;
    }
    if (dayEntries.length < 1) {
      setThirdPartyError("Log at least one food or drink for this date before saving a coach result.");
      setThirdPartyState("error");
      return;
    }
    const totals = sumDayTotals(entries, selectedDate);
    const inputSnapshot = coachAdviceInputSnapshotSchema.parse({
      dayCalories: totals.calories,
      dayProtein: totals.protein,
      dayCarbs: totals.carbs,
      dayFat: totals.fat,
      entryCount: dayEntries.length,
    });
    setThirdPartyState("saving");
    try {
      await recordCoachAdvice({ date: selectedDate, sequence: nextThirdPartySequence, inputSnapshot, summary });
      setThirdPartySummary("");
      setThirdPartyState("ok");
    } catch (e) {
      setThirdPartyError(e instanceof Error ? e.message : "Could not save third-party coach advice.");
      setThirdPartyState("error");
    }
  }

  async function onAskCoach() {
    setError(null);
    if (!canAsk || loading) return;
    const totals = sumDayTotals(entries, selectedDate);
    const sequence = (internalCoachCount + 1) as 1 | 2;
    const inputSnapshot = coachAdviceInputSnapshotSchema.parse({
      dayCalories: totals.calories,
      dayProtein: totals.protein,
      dayCarbs: totals.carbs,
      dayFat: totals.fat,
      entryCount: dayEntries.length,
    });
    const body = buildRequestForInternalCoach(sequence);

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
      <Card className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Extract AI Coach Prompt</p>
        <p className="text-xs leading-relaxed text-slate-500">
          Copy the exact prompt payload we send internally (including rolling 7-day context), run it in another LLM,
          then paste and save the response as a third-party coach message.
        </p>
        <Button type="button" variant="secondary" className="w-full" disabled={!canAsk || loading} onClick={() => void onCopyPrompt()}>
          Copy coach prompt
        </Button>
        {copyState === "ok" ? <p className="text-xs text-emerald-300">Prompt copied.</p> : null}
        {copyState === "error" ? (
          <p className="text-xs text-rose-300">Could not copy automatically. Please try again.</p>
        ) : null}
        <textarea
          rows={5}
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
          placeholder="Paste third-party AI coach output here..."
          value={thirdPartySummary}
          onChange={(ev) => {
            setThirdPartySummary(ev.target.value);
            setThirdPartyState("idle");
            setThirdPartyError(null);
          }}
        />
        <Button
          type="button"
          className="w-full"
          disabled={thirdPartyState === "saving" || !thirdPartySummary.trim()}
          onClick={() => void onSaveThirdPartyCoach()}
        >
          {thirdPartyState === "saving" ? "Saving third-party coach…" : "Save third-party AI Coach"}
        </Button>
        {thirdPartyState === "ok" ? <p className="text-xs text-emerald-300">Third-party coach message saved.</p> : null}
        {thirdPartyError ? <p className="text-xs text-rose-300">{thirdPartyError}</p> : null}
      </Card>

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
                #{active.sequence} for the day · {formatGeneratedAt(active.generatedAt)}
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
