import type { FoodLogEntry, LogItemCategory } from "@nutrilog/shared";

/** Minimum characters before querying — avoids huge result sets on single letters. */
export const FOOD_NAME_SUGGEST_MIN_CHARS = 2;

const DEFAULT_LIMIT = 3;

/**
 * Case-insensitive substring match on `foodName`, most recently updated first.
 * All processing is in-memory on the client (no network).
 */
export function searchPastEntriesByFoodName(
  entries: FoodLogEntry[],
  query: string,
  options: {
    excludeId?: string;
    itemCategory: LogItemCategory;
    limit?: number;
  },
): FoodLogEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < FOOD_NAME_SUGGEST_MIN_CHARS) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const { excludeId, itemCategory } = options;

  const matched = entries.filter((e) => {
    if (e.itemCategory !== itemCategory) return false;
    if (excludeId !== undefined && e.id === excludeId) return false;
    return e.foodName.toLowerCase().includes(q);
  });

  matched.sort((a, b) => {
    const diff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return matched.slice(0, limit);
}
