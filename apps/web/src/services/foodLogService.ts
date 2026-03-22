import type { FoodLogEntry, MealType } from "@nutrilog/shared";

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function filterEntriesForDate(entries: FoodLogEntry[], date: string): FoodLogEntry[] {
  return entries.filter((e) => e.date === date);
}

export function sumDayTotals(entries: FoodLogEntry[], date: string): DayTotals {
  const day = filterEntriesForDate(entries, date);
  return day.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function groupByMeal(entries: FoodLogEntry[], date: string): Record<MealType, FoodLogEntry[]> {
  const meals: Record<MealType, FoodLogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const e of entries) {
    if (e.date !== date) continue;
    meals[e.mealType].push(e);
  }
  for (const k of Object.keys(meals) as MealType[]) {
    meals[k].sort((a, b) => a.time.localeCompare(b.time));
  }
  return meals;
}

export function mealTotals(entries: FoodLogEntry[], date: string, meal: MealType): DayTotals {
  return filterEntriesForDate(entries, date)
    .filter((e) => e.mealType === meal)
    .reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}
