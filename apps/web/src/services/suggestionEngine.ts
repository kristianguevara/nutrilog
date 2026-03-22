import type { FoodLogEntry, SuggestionItem, UserProfile } from "@nutrilog/shared";
import { sumDayTotals } from "./foodLogService.js";

/**
 * Today-page suggestions are generated **entirely on-device** from your profile + logged entries.
 * **No OpenAI, no Gemini, no network** — zero API spend for this feature.
 * Regenerates when you change the selected day, edit entries, or update your profile (React `useMemo` on Today).
 */
export const SUGGESTIONS_ARE_LOCAL_ONLY = true as const;

function approxProteinGoalGrams(targetCalories: number | undefined): number | null {
  if (!targetCalories) return null;
  const grams = (targetCalories * 0.25) / 4;
  return Math.max(50, grams);
}

function dayEntries(entries: FoodLogEntry[], date: string): FoodLogEntry[] {
  return entries.filter((e) => e.date === date);
}

/** Approximate % of calories from each macro (Atwater factors). */
function macroEnergyPercents(calories: number, protein: number, carbs: number, fat: number) {
  if (calories < 50) return null;
  const pCal = protein * 4;
  const cCal = carbs * 4;
  const fCal = fat * 9;
  const sum = pCal + cCal + fCal;
  if (sum < 1) return null;
  return {
    proteinPct: (pCal / sum) * 100,
    carbPct: (cCal / sum) * 100,
    fatPct: (fCal / sum) * 100,
  };
}

/** Light keyword hint for “produce-forward” logging (heuristic, not exhaustive). */
function looksProduceForward(names: string[]): boolean {
  const blob = names.join(" ").toLowerCase();
  return /\b(salad|broccoli|spinach|kale|vegetable|veggie|fruit|berry|apple|banana|tomato|pepper|carrot|bean|lentil|oats)\b/.test(
    blob,
  );
}

type DayTotals = ReturnType<typeof sumDayTotals>;

function pushGoalSuggestions(
  out: SuggestionItem[],
  profile: UserProfile,
  totals: DayTotals,
  target: number,
): void {
  const remaining = Math.max(0, target - totals.calories);
  const ratio = totals.calories / target;

  if (profile.goalType === "lose_weight") {
    if (ratio >= 1) {
      out.push({
        id: "goal-lose-over",
        tone: "caution",
        title: "At or above today’s target",
        body: "For sustainable fat loss, many people do well prioritizing protein, fiber-rich foods, and sleep — not punishing restriction. If you’re still hungry, vegetables and lean protein tend to satiate with fewer calories.",
      });
    } else if (ratio >= 0.85) {
      out.push({
        id: "goal-lose-near",
        tone: "tip",
        title: "You’re close to today’s target",
        body: `Roughly ${Math.round(remaining)} kcal left (estimate). If hunger hits, protein plus vegetables is a pattern dietitians often recommend for fullness per calorie.`,
      });
    } else {
      out.push({
        id: "goal-lose-under",
        tone: "info",
        title: "Room left in your plan",
        body: `About ${Math.round(remaining)} kcal remaining. A balanced meal with protein, complex carbs, and color from plants supports steady energy — a habit linked to long-term adherence.`,
      });
    }
    return;
  }

  if (profile.goalType === "gain_weight") {
    if (ratio < 0.7) {
      out.push({
        id: "goal-gain-under",
        tone: "tip",
        title: "Below target so far",
        body: `You have roughly ${Math.round(remaining)} kcal to go (estimate). Pairing carbs with protein (e.g. yogurt + fruit, rice + eggs) supports training recovery and gradual weight gain without relying only on ultra-processed foods.`,
      });
    } else if (ratio >= 1) {
      out.push({
        id: "goal-gain-met",
        tone: "info",
        title: "Near your target today",
        body: "Consistency beats forcing every single day. If appetite is low tomorrow, liquid calories (milk, smoothies) or nut-dense snacks are common strategies — adjust to what you tolerate.",
      });
    }
    return;
  }

  if (profile.goalType === "maintain_weight" && ratio >= 0.95 && ratio <= 1.05) {
    out.push({
      id: "goal-maintain-band",
      tone: "info",
      title: "Steady with your target",
      body: "Maintenance is about repeating good-enough weeks, not perfect days. Small tweaks beat overhaul diets for longevity.",
    });
  }
}

function pushMacroSuggestions(
  out: SuggestionItem[],
  totals: DayTotals,
  target: number | null | undefined,
  macroPct: ReturnType<typeof macroEnergyPercents>,
): void {
  const proteinGoal = approxProteinGoalGrams(target ?? undefined);
  if (proteinGoal && totals.protein < proteinGoal * 0.65 && totals.calories > 400) {
    out.push({
      id: "protein-low",
      tone: "tip",
      title: "Protein may be light for today",
      body: "Adequate protein supports muscle maintenance and satiety as we age. Yogurt, fish, tofu, legumes, or eggs can close the gap — amounts here are still estimates from your log.",
    });
  }

  if (!macroPct || totals.calories <= 500) return;

  if (macroPct.carbPct > 58) {
    out.push({
      id: "carb-skew",
      tone: "tip",
      title: "Carbs are carrying a lot of today’s calories",
      body: "That’s not “bad” — but pairing starches with protein and adding vegetables or legumes often improves fullness and micronutrient variety, which supports long-term health.",
    });
  }
  if (macroPct.fatPct > 42) {
    out.push({
      id: "fat-skew",
      tone: "tip",
      title: "Fat is high in the mix today",
      body: "Healthy fats (olive oil, nuts, fish) fit many patterns; if most fat came from fried or ultra-processed sources, consider a few more plant-forward meals this week.",
    });
  }
}

function pushProduceEvening(
  out: SuggestionItem[],
  loggedCount: number,
  foodNames: string[],
  totals: DayTotals,
  target: number | null | undefined,
  localHour: number,
): void {
  if (loggedCount >= 2 && !looksProduceForward(foodNames) && totals.calories > 400) {
    out.push({
      id: "produce-variety",
      tone: "tip",
      title: "Think color on the plate",
      body: "Vegetables and fruit add fiber and polyphenols tied to cardiovascular and metabolic health in population studies. Your log doesn’t show many produce-forward items — add a side if you can.",
    });
  }

  if (target && totals.calories < target * 0.4 && localHour >= 17) {
    out.push({
      id: "cal-low-evening",
      tone: "tip",
      title: "Plenty of room left today",
      body: "If you’re hungry, a dinner with protein + starch + vegetables is a durable template. Undereating late can backfire with sleep and next-day cravings for some people.",
    });
  }
}

export function buildSuggestions(
  profile: UserProfile | null,
  entries: FoodLogEntry[],
  date: string,
  now: Date = new Date(),
): SuggestionItem[] {
  const out: SuggestionItem[] = [];

  if (!profile) {
    return [
      {
        id: "setup-profile",
        tone: "info",
        title: "Finish your profile",
        body: "Once onboarding knows your goal, NutriLog can tailor coaching-style nudges to your day — still estimates, not a substitute for a clinician.",
      },
    ];
  }

  const totals = sumDayTotals(entries, date);
  const logged = dayEntries(entries, date);
  const hasEntries = logged.length > 0;
  const target = profile.dailyCalorieTarget;
  const foodNames = logged.filter((e) => e.itemCategory === "food").map((e) => e.foodName);
  const macroPct = macroEnergyPercents(totals.calories, totals.protein, totals.carbs, totals.fat);
  const localHour = now.getHours();

  if (!hasEntries) {
    return [
      {
        id: "start-logging",
        tone: "tip",
        title: "Start with one honest log",
        body: "Long-term health tracking works best with consistency, not perfection. Log your next meal to unlock day-level coaching notes based on your numbers.",
      },
    ];
  }

  if (!target) {
    out.push({
      id: "no-target",
      tone: "info",
      title: "Optional: set a daily calorie target",
      body: "In Settings, a target helps pace protein, carbs, and fat across the day — useful for weight goals and for seeing how today compares to your plan (still an estimate).",
    });
  }

  if (target) {
    pushGoalSuggestions(out, profile, totals, target);
  }

  pushMacroSuggestions(out, totals, target, macroPct);
  pushProduceEvening(out, logged.length, foodNames, totals, target, localHour);

  if (out.length === 0) {
    out.push({
      id: "default-encourage",
      tone: "info",
      title: "Keep the log going",
      body: "Detailed notes on portions make week-to-week trends more meaningful — a habit that helps you and any future clinician see patterns.",
    });
  }

  return out.slice(0, 5);
}
