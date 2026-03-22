import type { FoodLogEntryDraft, ImageMetadata, MealType } from "@nutrilog/shared";
import { foodLogEntryDraftSchema } from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";

/**
 * PHASE 2 — Real integration
 * - Add a swappable `FoodScanProvider` implementation that calls a serverless route (see `apps/api`).
 * - Default model: GPT-5.4 mini (vision) returning structured JSON validated with Zod.
 * - Keep this client-side service as a thin adapter; do not embed API keys in the web bundle.
 */

export type ScanSourceMethod = "camera" | "upload" | "unknown";

export interface ScannedFoodDraft {
  draft: FoodLogEntryDraft;
  confidence: number;
  assumptions: string;
}

export interface FoodScanInput {
  file: File;
  imageMetadata: ImageMetadata;
  /** Default meal when the model cannot infer one */
  defaultMealType: MealType;
}

export interface FoodScanProvider {
  analyzeFoodImage(input: FoodScanInput): Promise<ScannedFoodDraft[]>;
}

function buildDraftFromMock(input: FoodScanInput, index: number): ScannedFoodDraft {
  const now = new Date();
  const date = formatLocalDateIso(now);
  const time = formatLocalTimeIso(now);
  const raw = {
    date,
    time,
    mealType: input.defaultMealType,
    foodName: index === 0 ? "Mixed plate (mock estimate)" : "Side item (mock estimate)",
    quantity: index === 0 ? 1 : 1,
    unit: index === 0 ? "plate" : "serving",
    calories: index === 0 ? 520 : 180,
    protein: index === 0 ? 28 : 6,
    carbs: index === 0 ? 45 : 22,
    fat: index === 0 ? 22 : 8,
    notes: undefined,
    sourceType: "ai_scan" as const,
    aiConfidence: 0.35,
    aiAssumptions:
      "Mock scan — replace with GPT-5.4 mini vision in Phase 2. Values are illustrative estimates only.",
    imageMetadata: input.imageMetadata,
  };
  return {
    draft: foodLogEntryDraftSchema.parse(raw),
    confidence: 0.35,
    assumptions:
      "This is a placeholder analysis. Photo was not sent to a model. Do not rely on these numbers.",
  };
}

class MockFoodScanProvider implements FoodScanProvider {
  async analyzeFoodImage(input: FoodScanInput): Promise<ScannedFoodDraft[]> {
    await new Promise((r) => setTimeout(r, 450));
    return [buildDraftFromMock(input, 0), buildDraftFromMock(input, 1)];
  }
}

let provider: FoodScanProvider = new MockFoodScanProvider();

export function setFoodScanProvider(next: FoodScanProvider): void {
  provider = next;
}

export function getFoodScanProvider(): FoodScanProvider {
  return provider;
}

export async function analyzeFoodImage(input: FoodScanInput): Promise<ScannedFoodDraft[]> {
  return provider.analyzeFoodImage(input);
}

export function buildImageMetadata(file: File, sourceMethod: ScanSourceMethod): ImageMetadata {
  return {
    filename: file.name || "food-image",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    sourceMethod: sourceMethod === "camera" ? "camera" : sourceMethod === "upload" ? "upload" : "unknown",
  };
}
