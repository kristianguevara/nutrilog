import type { CoachAdviceDayEntry, CoachAdviceRequest } from "@nutrilog/shared";
import type { FoodLogEntry, UserProfile } from "@nutrilog/shared";
import type { DayTotals } from "@/services/foodLogService.js";

export function entriesToCoachDayEntries(entries: FoodLogEntry[]): CoachAdviceDayEntry[] {
  return entries.map((e) => ({
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
  };
}
