import type { FoodScanRequestBody } from "@nutrilog/shared";

/** Shared instruction text for OpenAI and Gemini vision + JSON outputs. */
export function buildFoodScanInstruction(body: FoodScanRequestBody): string {
  const userContext =
    body.userDescription?.trim() ?
      `\n\nUser-provided context (use to interpret the photo; do not invent foods they did not describe unless clearly visible):\n${body.userDescription.trim()}`
    : "";

  return `You are helping with a personal food log (not medical advice). Analyze the meal photo and return ONLY valid JSON (no markdown) with this exact shape:
{"items":[{"foodName":"string","quantity":number,"unit":"string","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"assumptions":"string","mealType":"breakfast"|"lunch"|"dinner"|"snack" (optional)}]}
Rules:
- 1–8 distinct items when multiple foods are visible; otherwise 1–2 items.
- Numbers are rough estimates; confidence 0–1. Be conservative.
- assumptions: short honest caveats (lighting, hidden ingredients, portion guess).
- Optional mealType only if reasonably inferable from the image.${userContext}`;
}
