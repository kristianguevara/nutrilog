import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import {
  foodScanApiResponseSchema,
  foodScanRequestBodySchema,
} from "@nutrilog/shared";

export const config = {
  maxDuration: 60,
};

/**
 * Default vision-capable mini model. Override with OPENAI_MODEL (e.g. when your org exposes gpt-5.4-mini).
 * Never commit API keys; set OPENAI_API_KEY in Vercel env or `vercel env pull`.
 */
function resolveModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Plain one-line log for terminal readability (alongside JSON logs). */
function logStep(requestId: string, line: string): void {
  console.log(`[food-scan ${requestId.slice(0, 8)}] ${line}`);
}

function logScan(
  requestId: string,
  level: "info" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "food-scan",
    requestId,
    level,
    message,
    ...meta,
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

function sendJsonError(
  res: VercelResponse,
  status: number,
  requestId: string,
  code: string,
  error: string,
  details?: unknown,
): void {
  logScan(requestId, "error", error, { code, status, details });
  const body: { error: string; code: string; requestId: string; details?: unknown } = {
    error,
    code,
    requestId,
  };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = newRequestId();
  const handlerStartedAt = Date.now();

  try {
    if (req.method !== "POST") {
      sendJsonError(res, 405, requestId, "METHOD_NOT_ALLOWED", "Method not allowed");
      return;
    }

    logStep(requestId, "1/7 POST received");

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      sendJsonError(
        res,
        503,
        requestId,
        "MISSING_OPENAI_KEY",
        "Server missing OPENAI_API_KEY. Add it in Vercel Project Settings → Environment Variables.",
      );
      return;
    }

    let rawBody: unknown = req.body;
    if (typeof rawBody === "string") {
      try {
        rawBody = JSON.parse(rawBody) as unknown;
      } catch {
        sendJsonError(res, 400, requestId, "INVALID_JSON", "Invalid JSON body");
        return;
      }
    }

    const parsedBody = foodScanRequestBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      sendJsonError(res, 400, requestId, "INVALID_BODY", "Invalid request body", parsedBody.error.flatten());
      return;
    }

    logStep(requestId, "2/7 JSON body parsed & validated (Zod)");

    const body = parsedBody.data;
    const model = resolveModel();

    logScan(requestId, "info", "scan_start", {
      model,
      mimeType: body.mimeType,
      imageBytesApprox: Math.round((body.imageBase64?.length ?? 0) * 0.75),
      hasUserDescription: Boolean(body.userDescription?.trim()),
    });

    const userContext =
      body.userDescription?.trim() ?
        `\n\nUser-provided context (use to interpret the photo; do not invent foods they did not describe unless clearly visible):\n${body.userDescription.trim()}`
      : "";

    const systemText = `You are helping with a personal food log (not medical advice). Analyze the meal photo and return ONLY valid JSON (no markdown) with this exact shape:
{"items":[{"foodName":"string","quantity":number,"unit":"string","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"assumptions":"string","mealType":"breakfast"|"lunch"|"dinner"|"snack" (optional)}]}
Rules:
- 1–8 distinct items when multiple foods are visible; otherwise 1–2 items.
- Numbers are rough estimates; confidence 0–1. Be conservative.
- assumptions: short honest caveats (lighting, hidden ingredients, portion guess).
- Optional mealType only if reasonably inferable from the image.${userContext}`;

    const openai = new OpenAI({ apiKey });

    const openaiStartedAt = Date.now();
    logStep(requestId, `3/7 Calling OpenAI chat.completions (${model}, vision + json_object)…`);
    logScan(requestId, "info", "openai_request_dispatch", {
      model,
      maxTokens: 4096,
      elapsedMsSinceHandlerStart: openaiStartedAt - handlerStartedAt,
    });

    let completion;
    try {
      logStep(
        requestId,
        "4/7 Waiting on OpenAI (blocks here until the model returns — often 30s–3m+ for vision; check status.openai.com if unusually long)",
      );
      logScan(requestId, "info", "openai_awaiting_response", {
        note: "Waiting for OpenAI (vision + JSON). This can take 30s–120s+ for large images or slow API.",
      });
      completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemText },
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
      sendJsonError(res, 502, requestId, "OPENAI_REQUEST_FAILED", message);
      return;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      logStep(requestId, "5/7 ERROR: empty model message content");
      logScan(requestId, "error", "empty_model_response", { finishReason: completion.choices[0]?.finish_reason });
      sendJsonError(res, 502, requestId, "EMPTY_MODEL_RESPONSE", "Empty model response");
      return;
    }

    logStep(requestId, "6/7 Parsing model JSON…");
    let json: unknown;
    try {
      json = JSON.parse(extractJsonObject(raw));
    } catch (parseErr) {
      const hint = parseErr instanceof Error ? parseErr.message : "parse error";
      logScan(requestId, "error", "model_json_parse_failed", { hint, rawPreview: raw.slice(0, 400) });
      sendJsonError(res, 502, requestId, "MODEL_JSON_PARSE", "Model did not return valid JSON");
      return;
    }

    const validated = foodScanApiResponseSchema.safeParse(json);
    if (!validated.success) {
      logStep(requestId, "7/7 ERROR: Zod validation failed on model JSON");
      logScan(requestId, "error", "response_validation_failed", {
        issues: validated.error.flatten(),
      });
      sendJsonError(
        res,
        502,
        requestId,
        "RESPONSE_VALIDATION_FAILED",
        "Model JSON failed validation",
        validated.error.flatten(),
      );
      return;
    }

    logStep(requestId, `7/7 OK — sending ${validated.data.items.length} item(s) to client (${Date.now() - handlerStartedAt}ms total)`);
    logScan(requestId, "info", "scan_ok", {
      itemCount: validated.data.items.length,
      totalElapsedMs: Date.now() - handlerStartedAt,
    });
    res.status(200).json(validated.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error in food-scan handler";
    logScan(requestId, "error", "unhandled_handler_error", {
      message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    sendJsonError(res, 500, requestId, "UNHANDLED", message);
  }
}
