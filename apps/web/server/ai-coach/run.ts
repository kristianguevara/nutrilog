import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { coachAdviceResponseSchema, type CoachAdviceRequest, type CoachAdviceResponse } from "@nutrilog/shared";

import { extractJsonObject } from "../food-scan/parseResponse.js";
import { resolveFoodScanProvider } from "../food-scan/provider.js";
import type { FoodScanLogger } from "../food-scan/types.js";

function resolveOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function goalLabel(goal: CoachAdviceRequest["profile"]["goalType"]): string {
  switch (goal) {
    case "lose_weight":
      return "lose weight";
    case "maintain_weight":
      return "maintain weight";
    case "gain_weight":
      return "gain weight";
    default:
      return goal;
  }
}

export function buildCoachInstruction(body: CoachAdviceRequest): string {
  const p = body.profile;
  const targetLine =
    p.dailyCalorieTarget !== undefined ?
      `Daily calorie target: ~${Math.round(p.dailyCalorieTarget)} kcal`
    : "Daily calorie target: not set";

  const lines = body.entries
    .map((e) => {
      const kind = e.itemCategory === "drink" ? "drink" : "food";
      return `- ${e.time} · ${e.mealType} · ${kind}: ${e.foodName} (${e.quantity} ${e.unit}) → ${Math.round(e.calories)} kcal, P ${Math.round(e.protein)}g, C ${Math.round(e.carbs)}g, F ${Math.round(e.fat)}g`;
    })
    .join("\n");

  const recentDaysText = body.recentDays
    .map((d) => {
      const header = `Date ${d.date} totals: ${Math.round(d.totals.calories)} kcal, protein ${Math.round(
        d.totals.protein,
      )}g, carbs ${Math.round(d.totals.carbs)}g, fat ${Math.round(d.totals.fat)}g`;
      const dayLines = d.entries
        .map((e) => {
          const kind = e.itemCategory === "drink" ? "drink" : "food";
          return `  - ${e.time} · ${e.mealType} · ${kind}: ${e.foodName} (${e.quantity} ${e.unit}) → ${Math.round(e.calories)} kcal, P ${Math.round(e.protein)}g, C ${Math.round(e.carbs)}g, F ${Math.round(e.fat)}g`;
        })
        .join("\n");
      return dayLines ? `${header}\n${dayLines}` : `${header}\n  - No entries`;
    })
    .join("\n\n");

  const insight =
    body.coachInsightNumber === 1 ?
      "This is the user's FIRST coach request for this calendar day."
    : "This is the user's SECOND coach request for this calendar day. Offer a fresh angle or build on what might have changed since earlier — do not repeat the first message verbatim.";

  return `You are an experienced nutrition coach for a personal food log. This is educational, practical coaching — NOT medical diagnosis or treatment. Do not claim certainty about health outcomes.

${insight}

User: ${p.nickname?.trim() ? p.nickname.trim() : "User"}
Stated goal: ${goalLabel(p.goalType)}
${targetLine}
Log date: ${body.date}

Day totals (estimated from their log): ${Math.round(body.dayTotals.calories)} kcal, protein ${Math.round(body.dayTotals.protein)}g, carbs ${Math.round(body.dayTotals.carbs)}g, fat ${Math.round(body.dayTotals.fat)}g

Line items (selected date):
${lines}

Recent 7-day context (including selected date):
${recentDaysText}

Write ONE comprehensive coaching reply that covers:
1) Patterns over this day + the recent 7-day window
2) Food quality signals (fried/ultra-processed vs whole/minimally processed balance, fiber, protein quality, added sugar/sodium flags)
3) How intake aligns with their goal and long-term health direction
4) 3-5 concrete recommendations focused on sustainable diet and lifestyle improvements (food swaps, preparation methods, meal structure, consistency habits)
5) A brief supportive closing

If data is thin, say so gently and state what extra data would improve the next analysis.

Return ONLY valid JSON with this exact shape (no markdown fences):
{"summary":"..."}

Summary must be plain text inside JSON (use \\n for newlines if needed). Max ~8000 characters.`;
}

function parseCoachJson(raw: string):
  | { ok: true; data: CoachAdviceResponse }
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
  const validated = coachAdviceResponseSchema.safeParse(json);
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
      message: `Gemini model "${modelId}" was not found. Set GEMINI_MODEL to a current ID.`,
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
      details: { retryAfterSeconds, freeTierLimitZero },
    };
  }
  return { code: "GEMINI_REQUEST_FAILED", message: raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw };
}

export type CoachAdviceRunResult =
  | { ok: true; data: CoachAdviceResponse }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export async function runCoachAdvice(
  body: CoachAdviceRequest,
  opts: {
    requestId: string;
    handlerStartedAt: number;
    logger: FoodScanLogger;
  },
): Promise<CoachAdviceRunResult> {
  const { requestId, handlerStartedAt, logger } = opts;
  const { logStep, logScan } = logger;
  const instruction = buildCoachInstruction(body);
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
  logStep(requestId, `Calling ${provider} for AI coach…`);
  logScan(requestId, "info", "ai_coach_start", {
    provider,
    date: body.date,
    coachInsightNumber: body.coachInsightNumber,
    entryCount: body.entries.length,
  });

  try {
    let rawText: string;

    if (provider === "gemini") {
      const modelId = resolveGeminiModel();
      const genAI = new GoogleGenerativeAI(geminiKey!);
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          maxOutputTokens: 4096,
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
        max_tokens: 4096,
      });
      const content = completion.choices[0]?.message?.content;
      if (!content?.trim()) {
        return { ok: false, code: "EMPTY_MODEL_RESPONSE", message: "Empty model response" };
      }
      rawText = content;
    }

    logScan(requestId, "info", "ai_coach_model_raw", {
      elapsedMs: Date.now() - t0,
      chars: rawText.length,
    });

    const parsed = parseCoachJson(rawText);
    if (!parsed.ok) {
      return {
        ok: false,
        code: parsed.code,
        message: parsed.message,
        ...(parsed.details !== undefined ? { details: { detail: parsed.details } } : {}),
      };
    }

    logStep(requestId, `OK AI coach (${Date.now() - handlerStartedAt}ms total)`);
    return { ok: true, data: parsed.data };
  } catch (e: unknown) {
    if (provider === "gemini") {
      const modelId = resolveGeminiModel();
      const f = classifyGeminiFailure(e, modelId);
      logScan(requestId, "error", "ai_coach_gemini_failed", { message: f.message, code: f.code });
      return { ok: false, code: f.code, message: f.message, details: f.details };
    }
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    logScan(requestId, "error", "ai_coach_openai_failed", { message });
    return { ok: false, code: "OPENAI_REQUEST_FAILED", message };
  }
}
