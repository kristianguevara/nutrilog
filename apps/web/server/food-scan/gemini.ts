import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FoodScanRequestBody } from "@nutrilog/shared";

import type { FoodScanLogger, FoodScanModelResult } from "./types.js";

/** Default aligns with current Gemini API model IDs (1.5 IDs are often 404 on v1beta). Override with GEMINI_MODEL. */
function resolveModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function classifyGeminiError(
  e: unknown,
  modelId: string,
): Omit<Extract<FoodScanModelResult, { ok: false }>, "ok"> {
  const raw = e instanceof Error ? e.message : String(e);

  const modelNotFound =
    /\b404\b/.test(raw) ||
    /\bNot Found\b/i.test(raw) ||
    /is not found for API version/i.test(raw) ||
    /not supported for generateContent/i.test(raw);

  if (modelNotFound) {
    return {
      code: "GEMINI_MODEL_NOT_FOUND",
      message: `Gemini model "${modelId}" was not found or does not support generateContent (IDs change over time). Set GEMINI_MODEL to a current ID such as gemini-2.5-flash or gemini-2.5-flash-lite. See https://ai.google.dev/gemini-api/docs/models`,
      details: {
        requestedModel: modelId,
        docs: "https://ai.google.dev/gemini-api/docs/models",
      },
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
          "Gemini reports free-tier quota as 0 for this API key’s project. Link a billing account in Google Cloud to that project (you can still get free monthly allowance), and ensure the Generative Language API is enabled. See https://ai.google.dev/gemini-api/docs/rate-limits"
      : "Gemini rate limit or quota exceeded. Wait and retry, or check usage at https://ai.dev/rate-limit",
      details: {
        retryAfterSeconds,
        freeTierLimitZero,
        docs: "https://ai.google.dev/gemini-api/docs/rate-limits",
        usage: "https://ai.dev/rate-limit",
      },
    };
  }

  const truncated = raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
  return { code: "GEMINI_REQUEST_FAILED", message: truncated };
}

export async function runGeminiFoodScan(opts: {
  body: FoodScanRequestBody;
  instructionText: string;
  apiKey: string;
  requestId: string;
  handlerStartedAt: number;
  logger: FoodScanLogger;
}): Promise<FoodScanModelResult> {
  const { body, instructionText, apiKey, requestId, handlerStartedAt, logger } = opts;
  const { logStep, logScan } = logger;
  const modelId = resolveModel();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const startedAt = Date.now();
  logStep(requestId, `3/7 Calling Gemini generateContent (${modelId}, vision + JSON)…`);
  logScan(requestId, "info", "gemini_request_dispatch", {
    model: modelId,
    elapsedMsSinceHandlerStart: startedAt - handlerStartedAt,
  });

  try {
    logStep(
      requestId,
      "4/7 Waiting on Gemini (vision + JSON — often 15s–90s for large images)",
    );
    logScan(requestId, "info", "gemini_awaiting_response", {});

    const result = await model.generateContent([
      { text: instructionText },
      {
        inlineData: {
          mimeType: body.mimeType,
          data: body.imageBase64,
        },
      },
    ]);

    const elapsedMs = Date.now() - startedAt;
    const raw = result.response.text();
    logStep(requestId, `5/7 Gemini returned in ${elapsedMs}ms (${raw.length} chars)`);
    logScan(requestId, "info", "gemini_response_received", {
      elapsedMs,
      model: modelId,
      contentChars: raw.length,
    });

    if (!raw?.trim()) {
      logStep(requestId, "5/7 ERROR: empty Gemini response text");
      logScan(requestId, "error", "empty_gemini_response", {});
      return { ok: false, code: "EMPTY_MODEL_RESPONSE", message: "Empty model response" };
    }

    return { ok: true, rawText: raw };
  } catch (e: unknown) {
    const fullMessage = e instanceof Error ? e.message : String(e);
    logStep(requestId, `5/7 ERROR: Gemini threw — ${fullMessage.slice(0, 400)}`);
    logScan(requestId, "error", "gemini_request_failed", {
      message: fullMessage,
      elapsedMs: Date.now() - startedAt,
    });
    const classified = classifyGeminiError(e, modelId);
    return { ok: false, ...classified };
  }
}
