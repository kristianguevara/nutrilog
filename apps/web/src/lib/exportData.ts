import type { CoachAdvice, FoodLogEntry, SuggestionSnapshot, UserProfile } from "@nutrilog/shared";
import { compareIsoDate } from "@nutrilog/shared";

/** Discriminator for import pipelines (AI, SQL, other DBs). Bump when columns change. */
export const NUTRILOG_EXPORT_SCHEMA_VERSION = 3 as const;
export const NUTRILOG_EXPORT_FORMAT = "nutrilog-export" as const;

/**
 * Canonical JSON export shape. Stable keys for ETL: map `user` → users table,
 * `foodLogEntries` → food_log lines, `suggestionSnapshots` → optional analytics table,
 * `coachAdvice` → LLM coach messages (max 2 per day in-app).
 */
export interface NutrilogExportDocument {
  format: typeof NUTRILOG_EXPORT_FORMAT;
  schemaVersion: typeof NUTRILOG_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  dateRange: { start: string; end: string };
  user: NutrilogExportUser | null;
  foodLogEntries: FoodLogEntry[];
  suggestionSnapshots: SuggestionSnapshot[];
  coachAdvice: CoachAdvice[];
}

/** Flat profile row for CSV / SQL — mirrors UserProfile scalars. */
export interface NutrilogExportUser {
  nickname: string;
  email: string;
  goalType: string;
  dailyCalorieTarget: number | null;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use NutrilogExportDocument — kept for any in-repo references */
export type ExportBundle = NutrilogExportDocument;

function profileToExportUser(p: UserProfile): NutrilogExportUser {
  return {
    nickname: p.nickname,
    email: p.email,
    goalType: p.goalType,
    dailyCalorieTarget: p.dailyCalorieTarget ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
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

export function filterCoachAdviceInRange(
  history: CoachAdvice[],
  start: string,
  end: string,
): CoachAdvice[] {
  return history.filter(
    (h) => compareIsoDate(h.date, start) >= 0 && compareIsoDate(h.date, end) <= 0,
  );
}

export function buildExportBundle(
  profile: UserProfile | null,
  entries: FoodLogEntry[],
  suggestionHistory: SuggestionSnapshot[],
  coachAdviceHistory: CoachAdvice[],
  rangeStart: string,
  rangeEnd: string,
): NutrilogExportDocument {
  return {
    format: NUTRILOG_EXPORT_FORMAT,
    schemaVersion: NUTRILOG_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dateRange: { start: rangeStart, end: rangeEnd },
    user: profile ? profileToExportUser(profile) : null,
    foodLogEntries: filterEntriesInRange(entries, rangeStart, rangeEnd),
    suggestionSnapshots: filterSuggestionHistoryInRange(suggestionHistory, rangeStart, rangeEnd),
    coachAdvice: filterCoachAdviceInRange(coachAdviceHistory, rangeStart, rangeEnd),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Always quote JSON blobs so commas never break rows. */
function csvJsonCell(obj: unknown): string {
  return csvEscape(JSON.stringify(obj));
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return csvEscape(String(value));
}

const PROFILE_HEADER = [
  "nickname",
  "email",
  "goalType",
  "dailyCalorieTarget",
  "createdAt",
  "updatedAt",
] as const;

const FOOD_ENTRY_HEADER = [
  "id",
  "date",
  "time",
  "mealType",
  "itemCategory",
  "foodName",
  "quantity",
  "unit",
  "calories",
  "protein",
  "carbs",
  "fat",
  "notes",
  "sourceType",
  "aiConfidence",
  "aiAssumptions",
  "imageMetadata_json",
  "createdAt",
  "updatedAt",
] as const;

const SUGGESTION_HEADER = [
  "id",
  "date",
  "generatedAt",
  "input_dayCalories",
  "input_dayProtein",
  "input_dayCarbs",
  "input_dayFat",
  "input_entryCount",
  "suggestions_json",
] as const;

const COACH_ADVICE_HEADER = [
  "id",
  "date",
  "sequence",
  "generatedAt",
  "input_dayCalories",
  "input_dayProtein",
  "input_dayCarbs",
  "input_dayFat",
  "input_entryCount",
  "summary",
] as const;

/**
 * Multi-section CSV for spreadsheet + SQL tools:
 * - Metadata comment lines (#)
 * - SECTION:profile — one row (or empty cells if no profile)
 * - SECTION:food_log_entries — one row per log line, all scalars; image metadata as JSON column
 * - SECTION:suggestion_snapshots — flattened input snapshot + suggestions as JSON array
 * - SECTION:coach_advice — LLM coach summaries + input snapshot scalars
 */
export function exportBundleAsCsv(bundle: NutrilogExportDocument): string {
  const lines: string[] = [];
  lines.push(`# nutrilog-export-csv schemaVersion=${NUTRILOG_EXPORT_SCHEMA_VERSION}`);
  lines.push(`# exportedAt=${bundle.exportedAt}`);
  lines.push(`# dateRange.start=${bundle.dateRange.start}`);
  lines.push(`# dateRange.end=${bundle.dateRange.end}`);
  lines.push("");
  lines.push("SECTION:profile");
  lines.push(PROFILE_HEADER.join(","));
  if (bundle.user) {
    const u = bundle.user;
    lines.push(
      [
        csvCell(u.nickname),
        csvCell(u.email),
        csvCell(u.goalType),
        u.dailyCalorieTarget === null ? "" : csvCell(u.dailyCalorieTarget),
        csvCell(u.createdAt),
        csvCell(u.updatedAt),
      ].join(","),
    );
  } else {
    lines.push([...PROFILE_HEADER].map(() => "").join(","));
  }

  lines.push("");
  lines.push("SECTION:food_log_entries");
  lines.push(FOOD_ENTRY_HEADER.join(","));
  for (const e of bundle.foodLogEntries) {
    lines.push(
      [
        csvCell(e.id),
        csvCell(e.date),
        csvCell(e.time),
        csvCell(e.mealType),
        csvCell(e.itemCategory),
        csvCell(e.foodName),
        csvCell(e.quantity),
        csvCell(e.unit),
        csvCell(e.calories),
        csvCell(e.protein),
        csvCell(e.carbs),
        csvCell(e.fat),
        e.notes !== undefined ? csvCell(e.notes) : "",
        csvCell(e.sourceType),
        e.aiConfidence !== undefined ? csvCell(e.aiConfidence) : "",
        e.aiAssumptions !== undefined ? csvCell(e.aiAssumptions) : "",
        e.imageMetadata !== undefined ? csvJsonCell(e.imageMetadata) : "",
        csvCell(e.createdAt),
        csvCell(e.updatedAt),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("SECTION:suggestion_snapshots");
  lines.push(SUGGESTION_HEADER.join(","));
  for (const s of bundle.suggestionSnapshots) {
    const inp = s.inputSnapshot;
    lines.push(
      [
        csvCell(s.id),
        csvCell(s.date),
        csvCell(s.generatedAt),
        csvCell(inp.dayCalories),
        csvCell(inp.dayProtein),
        csvCell(inp.dayCarbs),
        csvCell(inp.dayFat),
        csvCell(inp.entryCount),
        csvJsonCell(s.suggestions),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("SECTION:coach_advice");
  lines.push(COACH_ADVICE_HEADER.join(","));
  for (const c of bundle.coachAdvice) {
    const inp = c.inputSnapshot;
    lines.push(
      [
        csvCell(c.id),
        csvCell(c.date),
        csvCell(c.sequence),
        csvCell(c.generatedAt),
        csvCell(inp.dayCalories),
        csvCell(inp.dayProtein),
        csvCell(inp.dayCarbs),
        csvCell(inp.dayFat),
        csvCell(inp.entryCount),
        csvCell(c.summary),
      ].join(","),
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function exportBundleAsJson(bundle: NutrilogExportDocument): string {
  return JSON.stringify(bundle, null, 2);
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
