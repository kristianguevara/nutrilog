import type { GoalType, LogItemCategory, MealType } from "@nutrilog/shared";
import { parseLocalDateIso } from "@nutrilog/shared";

export function logItemCategoryLabel(category: LogItemCategory): string {
  switch (category) {
    case "food":
      return "Food";
    case "drink":
      return "Drink";
    default:
      return category;
  }
}

export function mealLabel(meal: MealType): string {
  switch (meal) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case "snack":
      return "Snacks";
    default:
      return meal;
  }
}

export function goalLabel(goal: GoalType): string {
  switch (goal) {
    case "lose_weight":
      return "Lose weight";
    case "maintain_weight":
      return "Maintain weight";
    case "gain_weight":
      return "Gain weight";
    default:
      return "Goal";
  }
}

export function formatDisplayDate(isoDate: string): string {
  const d = parseLocalDateIso(isoDate);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
