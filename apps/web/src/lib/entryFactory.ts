import { foodLogEntrySchema } from "@nutrilog/shared";
import type { FoodLogEntry, FoodLogEntryDraft } from "@nutrilog/shared";

export function createFoodEntry(input: FoodLogEntryDraft): FoodLogEntry {
  const now = new Date().toISOString();
  return foodLogEntrySchema.parse({
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateFoodEntry(existing: FoodLogEntry, input: FoodLogEntryDraft): FoodLogEntry {
  const now = new Date().toISOString();
  return foodLogEntrySchema.parse({
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
}
