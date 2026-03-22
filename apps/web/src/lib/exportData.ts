import type { FoodLogEntry, SuggestionSnapshot, UserProfile } from "@nutrilog/shared";
import { compareIsoDate } from "@nutrilog/shared";

export interface ExportBundle {
  exportedAt: string;
  rangeStart: string;
  rangeEnd: string;
  profile: UserProfile | null;
  entries: FoodLogEntry[];
  suggestionHistory: SuggestionSnapshot[];
}

export function getEntryDateBounds(entries: FoodLogEntry[]): { min: string | null; max: string | null } {
  if (entries.length === 0) return { min: null, max: null };
  const sorted = [...entries].sort((a, b) => compareIsoDate(a.date, b.date));
  return { min: sorted[0]!.date, max: sorted[sorted.length - 1]!.date };
}

export function filterEntriesInRange(
  entries: FoodLogEntry[],
  start: string,
  end: string,
): FoodLogEntry[] {
  return entries.filter((e) => compareIsoDate(e.date, start) >= 0 && compareIsoDate(e.date, end) <= 0);
}

export function filterSuggestionHistoryInRange(
  history: SuggestionSnapshot[],
  start: string,
  end: string,
): SuggestionSnapshot[] {
  return history.filter(
    (h) => compareIsoDate(h.date, start) >= 0 && compareIsoDate(h.date, end) <= 0,
  );
}

export function buildExportBundle(
  profile: UserProfile | null,
  entries: FoodLogEntry[],
  suggestionHistory: SuggestionSnapshot[],
  rangeStart: string,
  rangeEnd: string,
): ExportBundle {
  return {
    exportedAt: new Date().toISOString(),
    rangeStart,
    rangeEnd,
    profile,
    entries: filterEntriesInRange(entries, rangeStart, rangeEnd),
    suggestionHistory: filterSuggestionHistoryInRange(suggestionHistory, rangeStart, rangeEnd),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportBundleAsJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function exportBundleAsCsv(bundle: ExportBundle): string {
  const header = [
    "date",
    "time",
    "mealType",
    "foodName",
    "quantity",
    "unit",
    "calories",
    "protein",
    "carbs",
    "fat",
    "notes",
    "sourceType",
  ];
  const lines = [header.join(",")];
  for (const e of bundle.entries) {
    const row = [
      e.date,
      e.time,
      e.mealType,
      e.foodName,
      String(e.quantity),
      e.unit,
      String(e.calories),
      String(e.protein),
      String(e.carbs),
      String(e.fat),
      e.notes ?? "",
      e.sourceType,
    ].map((c) => csvEscape(String(c)));
    lines.push(row.join(","));
  }
  lines.push("");
  lines.push("# suggestion_history_json");
  lines.push(csvEscape(JSON.stringify(bundle.suggestionHistory)));
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
