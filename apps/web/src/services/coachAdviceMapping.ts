import type { CoachAdviceDayEntry, CoachAdviceRequest } from "@nutrilog/shared";
import type { FoodLogEntry, UserProfile } from "@nutrilog/shared";
import type { DayTotals } from "@/services/foodLogService.js";

export function entriesToCoachDayEntries(entries: FoodLogEntry[]): CoachAdviceDayEntry[] {
  return entries.map((e) => ({
    date: e.date,
    time: e.time,
    mealType: e.mealType,
    itemCategory: e.itemCategory,
    foodName: e.foodName,
    quantity: e.quantity,
    unit: e.unit,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
  }));
}

export function buildCoachRequest(input: {
  date: string;
  coachInsightNumber: 1 | 2;
  profile: UserProfile;
  dayTotals: DayTotals;
  entries: FoodLogEntry[];
  recentDays: Array<{
    date: string;
    dayTotals: DayTotals;
    entries: FoodLogEntry[];
  }>;
}): CoachAdviceRequest {
  return {
    date: input.date,
    coachInsightNumber: input.coachInsightNumber,
    profile: {
      nickname: input.profile.nickname,
      goalType: input.profile.goalType,
      dailyCalorieTarget: input.profile.dailyCalorieTarget,
    },
    dayTotals: {
      calories: input.dayTotals.calories,
      protein: input.dayTotals.protein,
      carbs: input.dayTotals.carbs,
      fat: input.dayTotals.fat,
    },
    entries: entriesToCoachDayEntries(input.entries),
    recentDays: input.recentDays.map((day) => ({
      date: day.date,
      totals: {
        calories: day.dayTotals.calories,
        protein: day.dayTotals.protein,
        carbs: day.dayTotals.carbs,
        fat: day.dayTotals.fat,
      },
      entries: entriesToCoachDayEntries(day.entries),
    })),
  };
}

function goalLabel(goal: CoachAdviceRequest["profile"]["goalType"]): string {
  switch (goal) {
    case "lose_weight":
      return "lose weight";
    case "maintain_weight":
      return "maintain weight";
    case "gain_weight":
      return "gain weight";
    default:
      return goal;
  }
}

/**
 * Client copy of the instruction text so users can export the same prompt
 * to a third-party LLM and paste back the result.
 */
export function buildCoachPromptText(body: CoachAdviceRequest): string {
  const p = body.profile;
  const targetLine =
    p.dailyCalorieTarget !== undefined
      ? `Daily calorie target: ~${Math.round(p.dailyCalorieTarget)} kcal`
      : "Daily calorie target: not set";
  const insight =
    body.coachInsightNumber === 1
      ? "This is the user's FIRST coach request for this calendar day."
      : "This is the user's SECOND coach request for this calendar day. Offer a fresh angle or build on what might have changed since earlier - do not repeat the first message verbatim.";

  const todayLines = body.entries
    .map((e) => {
      const kind = e.itemCategory === "drink" ? "drink" : "food";
      return `- ${e.time} · ${e.mealType} · ${kind}: ${e.foodName} (${e.quantity} ${e.unit}) -> ${Math.round(e.calories)} kcal, P ${Math.round(e.protein)}g, C ${Math.round(e.carbs)}g, F ${Math.round(e.fat)}g`;
    })
    .join("\n");

  const recentDaysText = body.recentDays
    .map((d) => {
      const dayHeader = `Date ${d.date} totals: ${Math.round(d.totals.calories)} kcal, protein ${Math.round(
        d.totals.protein,
      )}g, carbs ${Math.round(d.totals.carbs)}g, fat ${Math.round(d.totals.fat)}g`;
      const lineItems = d.entries
        .map((e) => {
          const kind = e.itemCategory === "drink" ? "drink" : "food";
          return `  - ${e.time} · ${e.mealType} · ${kind}: ${e.foodName} (${e.quantity} ${e.unit}) -> ${Math.round(e.calories)} kcal, P ${Math.round(e.protein)}g, C ${Math.round(e.carbs)}g, F ${Math.round(e.fat)}g`;
        })
        .join("\n");
      return lineItems ? `${dayHeader}\n${lineItems}` : `${dayHeader}\n  - No entries`;
    })
    .join("\n\n");

  return `You are an experienced nutrition coach for a personal food log. This is educational, practical coaching - NOT medical diagnosis or treatment. Do not claim certainty about health outcomes.

${insight}

User: ${p.nickname?.trim() ? p.nickname.trim() : "User"}
Stated goal: ${goalLabel(p.goalType)}
${targetLine}
Log date: ${body.date}

Day totals (estimated from their log): ${Math.round(body.dayTotals.calories)} kcal, protein ${Math.round(body.dayTotals.protein)}g, carbs ${Math.round(body.dayTotals.carbs)}g, fat ${Math.round(body.dayTotals.fat)}g

Line items (selected date):
${todayLines}

Recent 7-day context (including selected date):
${recentDaysText}

Write ONE comprehensive coaching reply that covers:
1) Patterns over this day + the recent 7-day window
2) Food quality signals (fried/ultra-processed vs whole/minimally processed balance, fiber, protein quality, added sugar/sodium flags)
3) How intake aligns with their goal and long-term health direction
4) 3-5 concrete recommendations focused on sustainable diet and lifestyle improvements (food swaps, preparation methods, meal structure, consistency habits)
5) A brief supportive closing

If data is thin, say so gently and state what extra data would improve the next analysis.

Return ONLY valid JSON with this exact shape (no markdown fences):
IMPORTANT OUTPUT FORMAT FOR THIRD-PARTY EXPORT:
- Return plain text only (no JSON, no markdown code fences).
- Use short paragraphs and optional numbered bullets if useful.
- Keep it under ~8000 characters.`;
}
