import type { FoodLogEntry } from "@nutrilog/shared";
import { formatLocalDateIso, parseLocalDateIso } from "@nutrilog/shared";
import { sumDayTotals } from "./foodLogService.js";

export interface DayCaloriePoint {
  date: string;
  calories: number;
}

export interface SevenDayReport {
  rangeDates: string[];
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

function addDaysLocal(base: Date, delta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
  return d;
}

/** Last 7 local calendar days ending at `endDate` (inclusive). */
export function getSevenDayRange(endDate: Date): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    dates.push(formatLocalDateIso(addDaysLocal(endDate, -i)));
  }
  return dates;
}

export function buildSevenDayReport(
  entries: FoodLogEntry[],
  endDate: Date,
  dailyCalorieTarget: number | undefined,
): SevenDayReport {
  const rangeDates = getSevenDayRange(endDate);
  const caloriesByDay: DayCaloriePoint[] = rangeDates.map((date) => ({
    date,
    calories: sumDayTotals(entries, date).calories,
  }));

  const daysLogged = caloriesByDay.filter((d) => d.calories > 0).length;
  const totalCal = caloriesByDay.reduce((s, d) => s + d.calories, 0);
  const avgCalories = daysLogged > 0 ? totalCal / 7 : 0;

  let proteinSum = 0;
  let carbsSum = 0;
  let fatSum = 0;
  for (const date of rangeDates) {
    const t = sumDayTotals(entries, date);
    proteinSum += t.protein;
    carbsSum += t.carbs;
    fatSum += t.fat;
  }
  const avgProtein = proteinSum / 7;
  const avgCarbs = carbsSum / 7;
  const avgFat = fatSum / 7;

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
    `You averaged about ${Math.round(avgCalories)} kcal/day over the last 7 days (estimate).`,
  );
  insights.push(`You logged food on ${daysLogged} of the last 7 days.`);

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
    insights.push(`Protein was lowest on ${label} (among days with entries).`);
  }

  return {
    rangeDates,
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
