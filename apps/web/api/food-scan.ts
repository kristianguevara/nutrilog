import type { VercelRequest, VercelResponse } from "@vercel/node";
import { foodScanRequestBodySchema } from "@nutrilog/shared";

import { runGeminiFoodScan } from "../server/food-scan/gemini";
import { runOpenAiFoodScan } from "../server/food-scan/openai";
import { parseFoodScanModelOutput } from "../server/food-scan/parseResponse";
import { buildFoodScanInstruction } from "../server/food-scan/prompt";
import { resolveFoodScanProvider } from "../server/food-scan/provider";
import type { FoodScanLogger } from "../server/food-scan/types";

export const config = {
  maxDuration: 60,
};

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = newRequestId();
  const handlerStartedAt = Date.now();

  const logger: FoodScanLogger = {
    logStep,
    logScan,
  };

  try {
    if (req.method !== "POST") {
      sendJsonError(res, 405, requestId, "METHOD_NOT_ALLOWED", "Method not allowed");
      return;
    }

    logStep(requestId, "1/7 POST received");

    const provider = resolveFoodScanProvider();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    if (provider === "openai" && !openaiKey) {
      sendJsonError(
        res,
        503,
        requestId,
        "MISSING_OPENAI_KEY",
        "Server missing OPENAI_API_KEY. Add it in Vercel Project Settings → Environment Variables, or set FOOD_SCAN_PROVIDER=gemini with GEMINI_API_KEY.",
      );
      return;
    }

    if (provider === "gemini" && !geminiKey) {
      sendJsonError(
        res,
        503,
        requestId,
        "MISSING_GEMINI_KEY",
        "Server missing GEMINI_API_KEY. Add it in Vercel Project Settings → Environment Variables (Google AI Studio key).",
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
    const instructionText = buildFoodScanInstruction(body);

    logScan(requestId, "info", "scan_start", {
      provider,
      mimeType: body.mimeType,
      imageBytesApprox: Math.round((body.imageBase64?.length ?? 0) * 0.75),
      hasUserDescription: Boolean(body.userDescription?.trim()),
    });

    const modelResult =
      provider === "gemini" ?
        await runGeminiFoodScan({
          body,
          instructionText,
          apiKey: geminiKey!,
          requestId,
          handlerStartedAt,
          logger,
        })
      : await runOpenAiFoodScan({
          body,
          instructionText,
          apiKey: openaiKey!,
          requestId,
          handlerStartedAt,
          logger,
        });

    if (!modelResult.ok) {
      if (modelResult.code === "EMPTY_MODEL_RESPONSE") {
        sendJsonError(res, 502, requestId, "EMPTY_MODEL_RESPONSE", modelResult.message);
      } else if (modelResult.code === "GEMINI_MODEL_NOT_FOUND") {
        sendJsonError(res, 400, requestId, "GEMINI_MODEL_NOT_FOUND", modelResult.message, modelResult.details);
      } else if (modelResult.code === "GEMINI_QUOTA_EXCEEDED") {
        sendJsonError(res, 503, requestId, "GEMINI_QUOTA_EXCEEDED", modelResult.message, modelResult.details);
      } else if (modelResult.code === "GEMINI_REQUEST_FAILED") {
        sendJsonError(res, 502, requestId, "GEMINI_REQUEST_FAILED", modelResult.message, modelResult.details);
      } else {
        sendJsonError(res, 502, requestId, "OPENAI_REQUEST_FAILED", modelResult.message);
      }
      return;
    }

    logStep(requestId, "6/7 Parsing model JSON…");
    const parsed = parseFoodScanModelOutput(modelResult.rawText);
    if (!parsed.ok) {
      if (parsed.code === "MODEL_JSON_PARSE") {
        logScan(requestId, "error", "model_json_parse_failed", { details: parsed.details });
        sendJsonError(res, 502, requestId, "MODEL_JSON_PARSE", parsed.message, parsed.details);
      } else {
        logStep(requestId, "7/7 ERROR: Zod validation failed on model JSON");
        logScan(requestId, "error", "response_validation_failed", {
          issues: parsed.details,
        });
        sendJsonError(res, 502, requestId, "RESPONSE_VALIDATION_FAILED", parsed.message, parsed.details);
      }
      return;
    }

    logStep(requestId, `7/7 OK — sending ${parsed.data.items.length} item(s) to client (${Date.now() - handlerStartedAt}ms total)`);
    logScan(requestId, "info", "scan_ok", {
      itemCount: parsed.data.items.length,
      totalElapsedMs: Date.now() - handlerStartedAt,
    });
    res.status(200).json(parsed.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error in food-scan handler";
    logScan(requestId, "error", "unhandled_handler_error", {
      message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    sendJsonError(res, 500, requestId, "UNHANDLED", message);
  }
}
