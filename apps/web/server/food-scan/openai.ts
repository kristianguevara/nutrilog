import OpenAI from "openai";
import type { FoodScanRequestBody } from "@nutrilog/shared";

import type { FoodScanLogger, FoodScanModelResult } from "./types.js";

function resolveModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export async function runOpenAiFoodScan(opts: {
  body: FoodScanRequestBody;
  instructionText: string;
  apiKey: string;
  requestId: string;
  handlerStartedAt: number;
  logger: FoodScanLogger;
}): Promise<FoodScanModelResult> {
  const { body, instructionText, apiKey, requestId, handlerStartedAt, logger } = opts;
  const { logStep, logScan } = logger;
  const model = resolveModel();

  const openai = new OpenAI({ apiKey });
  const openaiStartedAt = Date.now();

  logStep(requestId, `3/7 Calling OpenAI chat.completions (${model}, vision + json_object)…`);
  logScan(requestId, "info", "openai_request_dispatch", {
    model,
    maxTokens: 4096,
    elapsedMsSinceHandlerStart: openaiStartedAt - handlerStartedAt,
  });

  try {
    logStep(
      requestId,
      "4/7 Waiting on OpenAI (blocks here until the model returns — often 30s–3m+ for vision; check status.openai.com if unusually long)",
    );
    logScan(requestId, "info", "openai_awaiting_response", {
      note: "Waiting for OpenAI (vision + JSON). This can take 30s–120s+ for large images or slow API.",
    });

    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructionText },
            {
              type: "image_url",
              image_url: {
                url: `data:${body.mimeType};base64,${body.imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const openaiElapsedMs = Date.now() - openaiStartedAt;
    logStep(requestId, `5/7 OpenAI returned in ${openaiElapsedMs}ms (${completion.usage?.total_tokens ?? "?"} tokens)`);
    logScan(requestId, "info", "openai_response_received", {
      elapsedMs: openaiElapsedMs,
      model: completion.model,
      finishReason: completion.choices[0]?.finish_reason,
      usage: completion.usage,
      contentChars: completion.choices[0]?.message?.content?.length ?? 0,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logStep(requestId, "5/7 ERROR: empty model message content");
      logScan(requestId, "error", "empty_model_response", { finishReason: completion.choices[0]?.finish_reason });
      return { ok: false, code: "EMPTY_MODEL_RESPONSE", message: "Empty model response" };
    }

    return { ok: true, rawText: raw };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    const status = typeof e === "object" && e !== null && "status" in e ? (e as { status?: number }).status : undefined;
    const errObj = e as { code?: string; type?: string };
    logStep(requestId, `5/7 ERROR: OpenAI threw — ${message}`);
    logScan(requestId, "error", "openai_request_failed", {
      message,
      elapsedMs: Date.now() - openaiStartedAt,
      status,
      code: errObj.code,
      type: errObj.type,
    });
    return { ok: false, code: "OPENAI_REQUEST_FAILED", message };
  }
}
