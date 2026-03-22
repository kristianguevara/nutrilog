import type { FoodMacroEstimateResponse } from "@nutrilog/shared";

export interface MacroEstimateInput {
  foodName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

function mockEstimate(): FoodMacroEstimateResponse {
  return {
    calories: 320,
    protein: 18,
    carbs: 38,
    fat: 12,
    assumptions:
      "Mock values — set VITE_FOOD_SCAN_MOCK=false and run with /api/food-macro-estimate (Vercel dev) for real AI estimates.",
  };
}

export async function estimateMacrosFromFood(input: MacroEstimateInput): Promise<FoodMacroEstimateResponse> {
  if (import.meta.env.VITE_FOOD_SCAN_MOCK === "true") {
    await new Promise((r) => setTimeout(r, 400));
    return mockEstimate();
  }

  const res = await fetch("/api/food-macro-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      foodName: input.foodName.trim(),
      quantity: input.quantity,
      unit: input.unit.trim(),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    }),
  });

  const rawText = await res.text();
  let payload: unknown = {};
  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      throw new Error(`Macro estimate failed (${res.status}). Server did not return JSON.`);
    }
  }

  const err = payload as { error?: string; code?: string; requestId?: string };
  if (!res.ok) {
    const msg = err.error ?? `Macro estimate failed (HTTP ${res.status})`;
    const code = err.code ? ` [${err.code}]` : "";
    const ref = err.requestId ? ` Ref: ${err.requestId}` : "";
    throw new Error(`${msg}${code}${ref}`);
  }

  const data = payload as FoodMacroEstimateResponse;
  if (
    typeof data.calories !== "number" ||
    typeof data.protein !== "number" ||
    typeof data.carbs !== "number" ||
    typeof data.fat !== "number"
  ) {
    throw new Error("Invalid macro estimate response.");
  }
  return data;
}
