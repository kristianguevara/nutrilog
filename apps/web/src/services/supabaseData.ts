import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoachAdvice,
  FoodLogEntry,
  NutrilogExportDocument,
  PersistedStateV3,
  SuggestionSnapshot,
  UserProfile,
} from "@nutrilog/shared";
import {
  coachAdviceSchema,
  foodLogEntrySchema,
  goalTypeSchema,
  suggestionSnapshotSchema,
  userProfileSchema,
} from "@nutrilog/shared";
import { getSupabase } from "@/lib/supabase/client.js";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return NaN;
}

function profileRowToProfile(row: Record<string, unknown>): UserProfile {
  const goal = goalTypeSchema.safeParse(row.goal_type);
  return userProfileSchema.parse({
    nickname: row.nickname,
    email: row.email,
    goalType: goal.success ? goal.data : "maintain_weight",
    dailyCalorieTarget:
      row.daily_calorie_target === null || row.daily_calorie_target === undefined
        ? undefined
        : num(row.daily_calorie_target),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  });
}

function foodLogEntryFromRow(row: Record<string, unknown>): FoodLogEntry {
  return foodLogEntrySchema.parse({
    id: row.id,
    date: String(row.date).slice(0, 10),
    time: row.time,
    mealType: row.meal_type,
    itemCategory: row.item_category ?? "food",
    foodName: row.food_name,
    quantity: num(row.quantity),
    unit: row.unit,
    calories: num(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    notes: row.notes ?? undefined,
    sourceType: row.source_type,
    aiConfidence: row.ai_confidence != null ? num(row.ai_confidence) : undefined,
    aiAssumptions: row.ai_assumptions ?? undefined,
    imageMetadata: row.image_metadata ?? undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  });
}

function suggestionFromRow(row: Record<string, unknown>): SuggestionSnapshot {
  return suggestionSnapshotSchema.parse({
    id: row.id,
    date: String(row.date).slice(0, 10),
    generatedAt: new Date(String(row.generated_at)).toISOString(),
    inputSnapshot: row.input_snapshot,
    suggestions: row.suggestions,
  });
}

function coachFromRow(row: Record<string, unknown>): CoachAdvice {
  return coachAdviceSchema.parse({
    id: row.id,
    date: String(row.date).slice(0, 10),
    sequence: num(row.sequence),
    generatedAt: new Date(String(row.generated_at)).toISOString(),
    inputSnapshot: row.input_snapshot,
    summary: row.summary,
  });
}

export function profileToDbRow(profile: UserProfile, userId: string) {
  return {
    id: userId,
    email: profile.email,
    nickname: profile.nickname,
    goal_type: profile.goalType,
    daily_calorie_target: profile.dailyCalorieTarget ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export function foodLogEntryToDbRow(entry: FoodLogEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    time: entry.time,
    meal_type: entry.mealType,
    item_category: entry.itemCategory,
    food_name: entry.foodName,
    quantity: entry.quantity,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    notes: entry.notes ?? null,
    source_type: entry.sourceType,
    ai_confidence: entry.aiConfidence ?? null,
    ai_assumptions: entry.aiAssumptions ?? null,
    image_metadata: entry.imageMetadata ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function suggestionToDbRow(s: SuggestionSnapshot, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    date: s.date,
    generated_at: s.generatedAt,
    input_snapshot: s.inputSnapshot,
    suggestions: s.suggestions,
  };
}

function coachToDbRow(c: CoachAdvice, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    date: c.date,
    sequence: c.sequence,
    generated_at: c.generatedAt,
    input_snapshot: c.inputSnapshot,
    summary: c.summary,
  };
}

export async function loadPersistedStateFromSupabase(
  userId: string,
): Promise<{ ok: true; data: PersistedStateV3 } | { ok: false; error: string }> {
  const supabase = getSupabase();
  const [pRes, eRes, sRes, cRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("food_log_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("suggestion_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false }),
    supabase.from("coach_advice").select("*").eq("user_id", userId).order("generated_at", { ascending: false }),
  ]);

  if (pRes.error) return { ok: false, error: pRes.error.message };
  if (eRes.error) return { ok: false, error: eRes.error.message };
  if (sRes.error) return { ok: false, error: sRes.error.message };
  if (cRes.error) return { ok: false, error: cRes.error.message };

  let profile: UserProfile | null = null;
  if (pRes.data) {
    try {
      profile = profileRowToProfile(pRes.data as Record<string, unknown>);
    } catch {
      return { ok: false, error: "Profile data from the server could not be read." };
    }
  }

  const entries: FoodLogEntry[] = [];
  for (const row of eRes.data ?? []) {
    try {
      entries.push(foodLogEntryFromRow(row as Record<string, unknown>));
    } catch {
      return { ok: false, error: "One or more food entries could not be read." };
    }
  }

  const suggestionHistory: SuggestionSnapshot[] = [];
  for (const row of sRes.data ?? []) {
    try {
      suggestionHistory.push(suggestionFromRow(row as Record<string, unknown>));
    } catch {
      return { ok: false, error: "Suggestion history could not be read." };
    }
  }

  const coachAdviceHistory: CoachAdvice[] = [];
  for (const row of cRes.data ?? []) {
    try {
      coachAdviceHistory.push(coachFromRow(row as Record<string, unknown>));
    } catch {
      return { ok: false, error: "Coach history could not be read." };
    }
  }

  return {
    ok: true,
    data: {
      version: 3,
      profile,
      entries,
      suggestionHistory,
      coachAdviceHistory,
    },
  };
}

export async function upsertProfileRemote(
  supabase: SupabaseClient,
  userId: string,
  profile: UserProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("profiles").upsert(profileToDbRow(profile, userId), { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function chunkUpsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  chunkSize: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(slice, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function importNutrilogExport(
  supabase: SupabaseClient,
  userId: string,
  sessionEmail: string,
  doc: NutrilogExportDocument,
  options: { mergeProfile: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const exportEmail = doc.user?.email?.trim().toLowerCase();
  const mine = sessionEmail.trim().toLowerCase();
  if (exportEmail && exportEmail !== mine) {
    return {
      ok: false,
      error: `Export is for ${doc.user?.email}. Sign in with that account, or remove the user block from the JSON.`,
    };
  }

  if (options.mergeProfile && doc.user) {
    const goal = goalTypeSchema.safeParse(doc.user.goalType);
    const t = new Date().toISOString();
    const profile = userProfileSchema.parse({
      nickname: doc.user.nickname,
      email: sessionEmail,
      goalType: goal.success ? goal.data : "maintain_weight",
      dailyCalorieTarget:
        doc.user.dailyCalorieTarget === null || doc.user.dailyCalorieTarget === undefined
          ? undefined
          : doc.user.dailyCalorieTarget,
      createdAt: doc.user.createdAt,
      updatedAt: t,
    });
    const up = await upsertProfileRemote(supabase, userId, profile);
    if (!up.ok) return up;
  }

  const foodRows = doc.foodLogEntries.map((e) => foodLogEntryToDbRow(e, userId)) as unknown as Record<string, unknown>[];
  const sugRows = doc.suggestionSnapshots.map((s) =>
    suggestionToDbRow(s, userId),
  ) as unknown as Record<string, unknown>[];
  const coachRows = doc.coachAdvice.map((c) => coachToDbRow(c, userId)) as unknown as Record<string, unknown>[];

  const a = await chunkUpsert(supabase, "food_log_entries", foodRows, 200);
  if (!a.ok) return a;
  const b = await chunkUpsert(supabase, "suggestion_snapshots", sugRows, 200);
  if (!b.ok) return b;
  const c = await chunkUpsert(supabase, "coach_advice", coachRows, 200);
  if (!c.ok) return c;

  return { ok: true };
}

export async function deleteAllUserData(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = ["coach_advice", "suggestion_snapshots", "food_log_entries", "profiles"] as const;
  for (const table of order) {
    const col = table === "profiles" ? "id" : "user_id";
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function insertFoodEntryRemote(
  supabase: SupabaseClient,
  userId: string,
  entry: FoodLogEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("food_log_entries").insert(foodLogEntryToDbRow(entry, userId));
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateFoodEntryRemote(
  supabase: SupabaseClient,
  userId: string,
  entry: FoodLogEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("food_log_entries")
    .update(foodLogEntryToDbRow(entry, userId))
    .eq("id", entry.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFoodEntryRemote(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("food_log_entries").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertSuggestionRemote(
  supabase: SupabaseClient,
  userId: string,
  snapshot: SuggestionSnapshot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("suggestion_snapshots").insert(suggestionToDbRow(snapshot, userId));
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertCoachAdviceRemote(
  supabase: SupabaseClient,
  userId: string,
  advice: CoachAdvice,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("coach_advice").insert(coachToDbRow(advice, userId));
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

