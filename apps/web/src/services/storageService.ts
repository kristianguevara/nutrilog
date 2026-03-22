import {
  persistedStateV1Schema,
  persistedStateV2Schema,
  type FoodLogEntry,
  type UserProfile,
} from "@nutrilog/shared";
import { z } from "zod";

const STORAGE_KEY = "nutrilog:v1:state";

const legacyUnionSchema = z.union([persistedStateV2Schema, persistedStateV1Schema]);

export type PersistedState = z.infer<typeof persistedStateV2Schema>;

export function createEmptyState(): PersistedState {
  return { version: 2, profile: null, entries: [], suggestionHistory: [] };
}

function normalizeToV2(raw: z.infer<typeof legacyUnionSchema>): PersistedState {
  if (raw.version === 2) {
    return raw;
  }
  return {
    version: 2,
    profile: raw.profile,
    entries: raw.entries,
    suggestionHistory: [],
  };
}

export function loadPersistedState(): { ok: true; data: PersistedState } | { ok: false; error: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ok: false, error: "Storage is not available in this environment." };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { ok: true, data: createEmptyState() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "Saved data could not be read. You can reset from Settings." };
  }
  const result = legacyUnionSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "Saved data is out of date or corrupted. You can reset from Settings." };
  }
  return { ok: true, data: normalizeToV2(result.data) };
}

export function savePersistedState(state: PersistedState): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ok: false, error: "Storage is not available in this environment." };
  }
  const parsed = persistedStateV2Schema.safeParse(state);
  if (!parsed.success) {
    return { ok: false, error: "Could not validate data before save." };
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save data. Your browser storage may be full or blocked." };
  }
}

export function clearPersistedState(): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ok: false, error: "Storage is not available in this environment." };
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not clear storage." };
  }
}

export function upsertProfile(state: PersistedState, profile: UserProfile): PersistedState {
  return { ...state, profile };
}

export function replaceEntries(state: PersistedState, entries: FoodLogEntry[]): PersistedState {
  return { ...state, entries };
}
