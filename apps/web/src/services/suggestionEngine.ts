import type { FoodLogEntry, UserProfile } from "@nutrilog/shared";
import { sumDayTotals } from "./foodLogService.js";

export type SuggestionTone = "info" | "tip" | "caution";

export interface Suggestion {
  id: string;
  tone: SuggestionTone;
  title: string;
  body: string;
}

function approxProteinGoalGrams(targetCalories: number | undefined): number | null {
  if (!targetCalories) return null;
  const grams = (targetCalories * 0.25) / 4;
  return Math.max(50, grams);
}

export function buildSuggestions(
  profile: UserProfile | null,
  entries: FoodLogEntry[],
  date: string,
): Suggestion[] {
  const out: Suggestion[] = [];

  if (!profile) {
    return [
      {
        id: "setup-profile",
        tone: "info",
        title: "Finish setup",
        body: "Complete onboarding so NutriLog can tailor simple, non-medical tips to your goal.",
      },
    ];
  }

  const totals = sumDayTotals(entries, date);
  const hasEntries = entries.some((e) => e.date === date);
  const target = profile.dailyCalorieTarget;

  if (!hasEntries) {
    out.push({
      id: "start-logging",
      tone: "tip",
      title: "Start with one meal",
      body: "Log your next meal to see today’s totals and get practical (estimated) feedback.",
    });
    return out;
  }

  if (!target) {
    out.push({
      id: "no-target",
      tone: "info",
      title: "Add a calorie target (optional)",
      body: "A daily target in Settings helps NutriLog suggest pacing for the rest of the day. This is an estimate, not a prescription.",
    });
  }

  if (target) {
    const remaining = Math.max(0, target - totals.calories);
    const ratio = totals.calories / target;

    if (profile.goalType === "lose_weight") {
      if (ratio >= 1) {
        out.push({
          id: "goal-lose-over",
          tone: "caution",
          title: "You’ve reached today’s target",
          body: "For a weight-loss goal, lighter snacks or smaller portions for the rest of the day are usually easier to sustain than strict rules.",
        });
      } else if (ratio >= 0.85) {
        out.push({
          id: "goal-lose-near",
          tone: "tip",
          title: "Close to today’s target",
          body: `About ${Math.round(remaining)} kcal left (estimate). Favor protein and vegetables if you’re still hungry.`,
        });
      } else {
        out.push({
          id: "goal-lose-under",
          tone: "info",
          title: "Room left today",
          body: `Roughly ${Math.round(remaining)} kcal remaining. A balanced meal with protein can keep energy steady.`,
        });
      }
    }

    if (profile.goalType === "gain_weight") {
      if (ratio < 0.7) {
        out.push({
          id: "goal-gain-under",
          tone: "tip",
          title: "Below your target so far",
          body: `You have about ${Math.round(remaining)} kcal to go (estimate). A carb + protein snack can help without feeling forced.`,
        });
      } else if (ratio >= 1) {
        out.push({
          id: "goal-gain-met",
          tone: "info",
          title: "Nice — you’re near your target",
          body: "Consistency beats perfection. If tomorrow is busier, keep a simple high-calorie snack on hand.",
        });
      }
    }

    if (profile.goalType === "maintain_weight") {
      if (ratio >= 0.95 && ratio <= 1.05) {
        out.push({
          id: "goal-maintain-band",
          tone: "info",
          title: "Steady pacing",
          body: "You’re close to your target today. Small adjustments are usually enough day to day.",
        });
      }
    }
  }

  const proteinGoal = approxProteinGoalGrams(target ?? undefined);
  if (proteinGoal && totals.protein < proteinGoal * 0.65 && totals.calories > 400) {
    out.push({
      id: "protein-low",
      tone: "tip",
      title: "Protein might be a bit low today",
      body: "Consider yogurt, eggs, tofu, fish, or beans — amounts are estimates; adjust to what fits you.",
    });
  }

  if (target && totals.calories < target * 0.4 && new Date().getHours() >= 17) {
    out.push({
      id: "cal-low-evening",
      tone: "tip",
      title: "Plenty of room left",
      body: "If you’re hungry, a balanced dinner with carbs and protein is a practical way to close the day.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "default-encourage",
      tone: "info",
      title: "Keep logging",
      body: "Short notes on portions make week-to-week trends more meaningful.",
    });
  }

  return out.slice(0, 4);
}
