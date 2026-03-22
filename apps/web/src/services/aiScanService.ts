import type { FoodLogEntryDraft, ImageMetadata, MealType } from "@nutrilog/shared";
import {
  foodLogEntryDraftSchema,
  foodScanApiResponseSchema,
} from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";

/**
 * Client adapter: calls `POST /api/food-scan` (Vercel serverless). API keys stay on the server only.
 * Set `VITE_FOOD_SCAN_MOCK=true` to force the offline mock (no network).
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
  defaultMealType: MealType;
  /** Optional details from the user; sent to the vision API and saved on drafts as `notes`. */
  description?: string;
  /** Called as the client moves through each step (for UI activity log). */
  onStep?: (message: string) => void;
}

export interface FoodScanProvider {
  analyzeFoodImage(input: FoodScanInput): Promise<ScannedFoodDraft[]>;
}

function buildDraftFromMock(input: FoodScanInput, index: number): ScannedFoodDraft {
  const now = new Date();
  const date = formatLocalDateIso(now);
  const time = formatLocalTimeIso(now);
  const desc = input.description?.trim();
  const raw = {
    date,
    time,
    mealType: input.defaultMealType,
    itemCategory: "food" as const,
    foodName: index === 0 ? "Mixed plate (mock estimate)" : "Side item (mock estimate)",
    quantity: index === 0 ? 1 : 1,
    unit: index === 0 ? "plate" : "serving",
    calories: index === 0 ? 520 : 180,
    protein: index === 0 ? 28 : 6,
    carbs: index === 0 ? 45 : 22,
    fat: index === 0 ? 22 : 8,
    notes: desc || undefined,
    sourceType: "ai_scan" as const,
    aiConfidence: 0.35,
    aiAssumptions:
      "Mock scan — set VITE_FOOD_SCAN_MOCK=false and configure server-side vision (OPENAI_API_KEY or FOOD_SCAN_PROVIDER=gemini with GEMINI_API_KEY).",
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
    input.onStep?.("Mock mode: preparing placeholder…");
    await new Promise((r) => setTimeout(r, 200));
    input.onStep?.("Mock mode: returning sample estimates (no API call).");
    await new Promise((r) => setTimeout(r, 250));
    return [buildDraftFromMock(input, 0), buildDraftFromMock(input, 1)];
  }
}

async function fileToBase64Parts(file: File): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image file."));
    r.readAsDataURL(file);
  });
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Could not encode image as base64.");
  return { mimeType: m[1]!, base64: m[2]! };
}

class ApiFoodScanProvider implements FoodScanProvider {
  async analyzeFoodImage(input: FoodScanInput): Promise<ScannedFoodDraft[]> {
    const step = input.onStep;
    step?.("Reading image from your device…");
    const { base64, mimeType } = await fileToBase64Parts(input.file);
    step?.(`Encoded image (${mimeType}, ~${Math.round((base64.length * 3) / 4 / 1024)} KB raw).`);

    const now = new Date();
    const date = formatLocalDateIso(now);
    const time = formatLocalTimeIso(now);

    const userDescription = input.description?.trim() || undefined;

    step?.("Sending POST /api/food-scan (browser → dev server)…");
    const res = await fetch("/api/food-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        defaultMealType: input.defaultMealType,
        date,
        time,
        imageMetadata: input.imageMetadata,
        ...(userDescription ? { userDescription } : {}),
      }),
    });

    step?.(
      res.ok
        ? "Server responded; downloading response body…"
        : `Server responded with HTTP ${res.status}; reading body…`,
    );
    const rawText = await res.text();
    let payload: unknown = {};
    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as unknown;
      } catch {
        if (import.meta.env.DEV) {
          console.error("[food-scan] Non-JSON response", { status: res.status, body: rawText.slice(0, 800) });
        }
        throw new Error(
          `Scan failed (${res.status}). Server did not return JSON — check Vercel / terminal logs. Body preview: ${rawText.slice(0, 120)}${rawText.length > 120 ? "…" : ""}`,
        );
      }
    }

    const errPayload = payload as {
      error?: string;
      code?: string;
      requestId?: string;
      details?: unknown;
    };

    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.error("[food-scan] Error response", {
          status: res.status,
          code: errPayload.code,
          requestId: errPayload.requestId,
          error: errPayload.error,
          details: errPayload.details,
        });
      }
      const msg = errPayload.error ?? `Scan failed (HTTP ${res.status})`;
      const code = errPayload.code ? ` [${errPayload.code}]` : "";
      const ref = errPayload.requestId ? ` Ref: ${errPayload.requestId}` : "";
      throw new Error(`${msg}${code}${ref}`);
    }

    step?.("Parsing JSON and validating food items…");
    const validated = foodScanApiResponseSchema.safeParse(payload);
    if (!validated.success) {
      throw new Error("Server response was not valid food scan data.");
    }

    step?.(`Done: ${validated.data.items.length} line item(s) from model.`);
    return validated.data.items.map((item) => {
      const draft = foodLogEntryDraftSchema.parse({
        date,
        time,
        mealType: item.mealType ?? input.defaultMealType,
        itemCategory: "food",
        foodName: item.foodName,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        notes: userDescription,
        sourceType: "ai_scan" as const,
        aiConfidence: item.confidence,
        aiAssumptions: item.assumptions,
        imageMetadata: input.imageMetadata,
      });
      return {
        draft,
        confidence: item.confidence,
        assumptions: item.assumptions,
      };
    });
  }
}

let provider: FoodScanProvider = resolveDefaultProvider();

function resolveDefaultProvider(): FoodScanProvider {
  const mock = import.meta.env.VITE_FOOD_SCAN_MOCK === "true";
  return mock ? new MockFoodScanProvider() : new ApiFoodScanProvider();
}

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
