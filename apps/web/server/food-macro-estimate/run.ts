import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  foodMacroEstimateResponseSchema,
  type FoodMacroEstimateRequest,
  type FoodMacroEstimateResponse,
} from "@nutrilog/shared";

import { extractJsonObject } from "../food-scan/parseResponse";
import { resolveFoodScanProvider } from "../food-scan/provider";
import type { FoodScanLogger } from "../food-scan/types";

function resolveOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function buildMacroEstimateInstruction(body: FoodMacroEstimateRequest): string {
  const notesBlock =
    body.notes?.trim() ?
      `\n\nAdditional context from the user (brand, preparation, packaging, etc.):\n${body.notes.trim()}`
    : "";

  return `You are helping with a personal food log (not medical advice). Estimate total nutrition for ONE entry.

Food name: ${body.foodName.trim()}
Quantity: ${body.quantity}
Unit: ${body.unit.trim()}${notesBlock}

Return ONLY valid JSON with this exact shape (no markdown):
{"calories":number,"protein":number,"carbs":number,"fat":number,"assumptions":"string"}

Rules:
- Each numeric field MUST be exactly one number (never a range, never min/max pairs, never "X–Y" in JSON).
- If sources would give a range, pick a single representative value (prefer the midpoint of common published estimates for this portion) and put any caveat only in "assumptions".
- calories: total kcal for the quantity and unit above (not per 100g unless the unit is literally "100g").
- protein, carbs, fat: grams for that same amount.
- assumptions: one short sentence; you may mention uncertainty there, but the four numbers above must still be single scalars.
- Use reasonable database-style estimates; round calories to whole numbers and macros to one decimal when helpful.`;
}

function parseMacroJson(raw: string):
  | { ok: true; data: FoodMacroEstimateResponse }
  | { ok: false; code: "MODEL_JSON_PARSE" | "RESPONSE_VALIDATION_FAILED"; message: string; details?: unknown } {
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
  const validated = foodMacroEstimateResponseSchema.safeParse(json);
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

type GeminiFailure = { code: string; message: string; details?: Record<string, unknown> };

function classifyGeminiFailure(e: unknown, modelId: string): GeminiFailure {
  const raw = e instanceof Error ? e.message : String(e);
  if (
    /\b404\b/.test(raw) ||
    /\bNot Found\b/i.test(raw) ||
    /is not found for API version/i.test(raw) ||
    /not supported for generateContent/i.test(raw)
  ) {
    return {
      code: "GEMINI_MODEL_NOT_FOUND",
      message: `Gemini model "${modelId}" was not found. Set GEMINI_MODEL to a current ID. See https://ai.google.dev/gemini-api/docs/models`,
      details: { requestedModel: modelId },
    };
  }
  const rateOrQuota =
    /\b429\b/.test(raw) ||
    /\bToo Many Requests\b/i.test(raw) ||
    /Quota exceeded/i.test(raw) ||
    /ResourceExhausted/i.test(raw) ||
    /limit:\s*0/i.test(raw);
  if (rateOrQuota) {
    const retryMatch = raw.match(/Please retry in ([\d.]+)s/i);
    const retryAfterSeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : undefined;
    const freeTierLimitZero = /limit:\s*0/i.test(raw);
    return {
      code: "GEMINI_QUOTA_EXCEEDED",
      message: freeTierLimitZero ?
          "Gemini free-tier quota is 0 for this project. Link billing in Google Cloud or check rate limits."
      : "Gemini rate limit or quota exceeded.",
      details: { retryAfterSeconds, freeTierLimitZero, docs: "https://ai.google.dev/gemini-api/docs/rate-limits" },
    };
  }
  return { code: "GEMINI_REQUEST_FAILED", message: raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw };
}

export type MacroEstimateRunResult =
  | { ok: true; data: FoodMacroEstimateResponse }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export async function runMacroEstimate(
  body: FoodMacroEstimateRequest,
  opts: {
    requestId: string;
    handlerStartedAt: number;
    logger: FoodScanLogger;
  },
): Promise<MacroEstimateRunResult> {
  const { requestId, handlerStartedAt, logger } = opts;
  const { logStep, logScan } = logger;
  const instruction = buildMacroEstimateInstruction(body);
  const provider = resolveFoodScanProvider();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (provider === "openai" && !openaiKey) {
    return {
      ok: false,
      code: "MISSING_OPENAI_KEY",
      message: "Server missing OPENAI_API_KEY.",
    };
  }
  if (provider === "gemini" && !geminiKey) {
    return {
      ok: false,
      code: "MISSING_GEMINI_KEY",
      message: "Server missing GEMINI_API_KEY.",
    };
  }

  const t0 = Date.now();
  logStep(requestId, `Calling ${provider} for macro estimate…`);
  logScan(requestId, "info", "macro_estimate_start", {
    provider,
    foodNameLen: body.foodName.length,
    hasNotes: Boolean(body.notes?.trim()),
  });

  try {
    let rawText: string;

    if (provider === "gemini") {
      const modelId = resolveGeminiModel();
      const genAI = new GoogleGenerativeAI(geminiKey!);
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(instruction);
      rawText = result.response.text();
      if (!rawText?.trim()) {
        return { ok: false, code: "EMPTY_MODEL_RESPONSE", message: "Empty model response" };
      }
    } else {
      const model = resolveOpenAiModel();
      const openai = new OpenAI({ apiKey: openaiKey! });
      const completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: instruction }],
        max_tokens: 1024,
      });
      const content = completion.choices[0]?.message?.content;
      if (!content?.trim()) {
        return { ok: false, code: "EMPTY_MODEL_RESPONSE", message: "Empty model response" };
      }
      rawText = content;
    }

    logScan(requestId, "info", "macro_estimate_model_raw", {
      elapsedMs: Date.now() - t0,
      chars: rawText.length,
    });

    const parsed = parseMacroJson(rawText);
    if (!parsed.ok) {
      return {
        ok: false,
        code: parsed.code,
        message: parsed.message,
        ...(parsed.details !== undefined ? { details: { detail: parsed.details } } : {}),
      };
    }

    logStep(requestId, `OK macro estimate (${Date.now() - handlerStartedAt}ms total)`);
    return { ok: true, data: parsed.data };
  } catch (e: unknown) {
    if (provider === "gemini") {
      const modelId = resolveGeminiModel();
      const f = classifyGeminiFailure(e, modelId);
      logScan(requestId, "error", "macro_estimate_gemini_failed", { message: f.message, code: f.code });
      return { ok: false, code: f.code, message: f.message, details: f.details };
    }
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    logScan(requestId, "error", "macro_estimate_openai_failed", { message });
    return { ok: false, code: "OPENAI_REQUEST_FAILED", message };
  }
}
