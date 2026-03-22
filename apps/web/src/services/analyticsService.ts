import type { FoodLogEntry } from "@nutrilog/shared";
import { eachDateInInclusiveRange, formatLocalDateIso, parseLocalDateIso } from "@nutrilog/shared";
import { sumDayTotals } from "./foodLogService.js";

export interface DayCaloriePoint {
  date: string;
  calories: number;
}

export interface RangeReport {
  startDate: string;
  endDate: string;
  rangeDates: string[];
  dayCount: number;
  daysLogged: number;
  avgCalories: number;
  caloriesByDay: DayCaloriePoint[];
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  highestDay: DayCaloriePoint | null;
  lowestDay: DayCaloriePoint | null;
  insights: string[];
}

/** Default “Reports” window: last 7 weeks (49 local days) ending today. */
export function defaultReportsRangeEndToday(): { startDate: string; endDate: string } {
  const end = new Date();
  const endDate = formatLocalDateIso(end);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (7 * 7 - 1));
  const startDate = formatLocalDateIso(start);
  return { startDate, endDate };
}

/** Default Reports window: last `n` inclusive local days ending today (e.g. n=7 → last week). */
export function defaultLastNDaysInclusive(n: number): { startDate: string; endDate: string } {
  const end = new Date();
  const endDate = formatLocalDateIso(end);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1));
  const startDate = formatLocalDateIso(start);
  return { startDate, endDate };
}

export function buildRangeReport(
  entries: FoodLogEntry[],
  startDate: string,
  endDate: string,
  dailyCalorieTarget: number | undefined,
): RangeReport {
  const rangeDates = eachDateInInclusiveRange(startDate, endDate);
  const dayCount = rangeDates.length;

  const caloriesByDay: DayCaloriePoint[] = rangeDates.map((date) => ({
    date,
    calories: sumDayTotals(entries, date).calories,
  }));

  const daysLogged = caloriesByDay.filter((d) => d.calories > 0).length;
  const totalCal = caloriesByDay.reduce((s, d) => s + d.calories, 0);
  const avgCalories = dayCount > 0 ? totalCal / dayCount : 0;

  let proteinSum = 0;
  let carbsSum = 0;
  let fatSum = 0;
  for (const date of rangeDates) {
    const t = sumDayTotals(entries, date);
    proteinSum += t.protein;
    carbsSum += t.carbs;
    fatSum += t.fat;
  }
  const denom = dayCount > 0 ? dayCount : 1;
  const avgProtein = proteinSum / denom;
  const avgCarbs = carbsSum / denom;
  const avgFat = fatSum / denom;

  const nonZero = caloriesByDay.filter((d) => d.calories > 0);
  const highestDay =
    nonZero.length === 0
      ? null
      : nonZero.reduce((a, b) => (a.calories >= b.calories ? a : b), nonZero[0]!);
  const lowestDay =
    nonZero.length === 0
      ? null
      : nonZero.reduce((a, b) => (a.calories <= b.calories ? a : b), nonZero[0]!);

  const insights: string[] = [];
  insights.push(
    `You averaged about ${Math.round(avgCalories)} kcal/day across ${dayCount} day(s) in this range (estimate).`,
  );
  insights.push(`You logged food on ${daysLogged} of ${dayCount} day(s) in this range.`);

  if (dailyCalorieTarget && daysLogged > 0) {
    if (avgCalories > dailyCalorieTarget + 150) {
      insights.push(
        `Your average intake was above your daily target of ${Math.round(dailyCalorieTarget)} kcal (rough comparison, not medical advice).`,
      );
    } else if (avgCalories < dailyCalorieTarget - 150) {
      insights.push(
        `Your average intake was below your daily target of ${Math.round(dailyCalorieTarget)} kcal (rough comparison, not medical advice).`,
      );
    } else {
      insights.push(
        `Your average intake was close to your target of ${Math.round(dailyCalorieTarget)} kcal (rough comparison).`,
      );
    }
  }

  const proteinByDay = rangeDates.map((date) => ({
    date,
    protein: sumDayTotals(entries, date).protein,
  }));
  const daysWithProtein = proteinByDay.filter((d) => d.protein > 0);
  if (daysWithProtein.length > 0) {
    const minP = daysWithProtein.reduce(
      (a, b) => (a.protein <= b.protein ? a : b),
      daysWithProtein[0]!,
    );
    const label = formatShortWeekday(minP.date);
    insights.push(`Protein was lowest on ${label} (among days with entries in this range).`);
  }

  return {
    startDate,
    endDate,
    rangeDates,
    dayCount,
    daysLogged,
    avgCalories,
    caloriesByDay,
    avgProtein,
    avgCarbs,
    avgFat,
    highestDay,
    lowestDay,
    insights,
  };
}

function formatShortWeekday(isoDate: string): string {
  const d = parseLocalDateIso(isoDate);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
