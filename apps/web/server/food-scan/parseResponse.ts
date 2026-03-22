import { foodScanApiResponseSchema } from "@nutrilog/shared";
import type { z } from "zod";

export type FoodScanApiResponseData = z.infer<typeof foodScanApiResponseSchema>;

export function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

export type ParsedFoodScan =
  | { ok: true; data: FoodScanApiResponseData }
  | { ok: false; code: "MODEL_JSON_PARSE" | "RESPONSE_VALIDATION_FAILED"; message: string; details?: unknown };

export function parseFoodScanModelOutput(raw: string): ParsedFoodScan {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(raw));
  } catch (parseErr) {
    const hint = parseErr instanceof Error ? parseErr.message : "parse error";
    return {
      ok: false,
      code: "MODEL_JSON_PARSE",
      message: `Model did not return valid JSON (${hint})`,
      details: { rawPreview: raw.slice(0, 400) },
    };
  }

  const validated = foodScanApiResponseSchema.safeParse(json);
  if (!validated.success) {
    return {
      ok: false,
      code: "RESPONSE_VALIDATION_FAILED",
      message: "Model JSON failed validation",
      details: validated.error.flatten(),
    };
  }

  return { ok: true, data: validated.data };
}
