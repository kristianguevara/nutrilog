import type { VercelRequest, VercelResponse } from "@vercel/node";
import { coachAdviceRequestSchema } from "@nutrilog/shared";

import { runCoachAdvice } from "../server/ai-coach/run";
import type { FoodScanLogger } from "../server/food-scan/types";

export const config = {
  maxDuration: 60,
};

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function logStep(requestId: string, line: string): void {
  console.log(`[ai-coach ${requestId.slice(0, 8)}] ${line}`);
}

function logScan(
  requestId: string,
  level: "info" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "ai-coach",
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

  const logger: FoodScanLogger = { logStep, logScan };

  try {
    if (req.method !== "POST") {
      sendJsonError(res, 405, requestId, "METHOD_NOT_ALLOWED", "Method not allowed");
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

    const parsed = coachAdviceRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      sendJsonError(res, 400, requestId, "INVALID_BODY", "Invalid request body", parsed.error.flatten());
      return;
    }

    const result = await runCoachAdvice(parsed.data, { requestId, handlerStartedAt, logger });

    if (!result.ok) {
      const { code, message, details } = result;
      if (code === "INVALID_BODY") {
        sendJsonError(res, 400, requestId, code, message, details);
      } else if (code === "MISSING_OPENAI_KEY" || code === "MISSING_GEMINI_KEY") {
        sendJsonError(res, 503, requestId, code, message, details);
      } else if (code === "GEMINI_MODEL_NOT_FOUND") {
        sendJsonError(res, 400, requestId, code, message, details);
      } else if (code === "GEMINI_QUOTA_EXCEEDED") {
        sendJsonError(res, 503, requestId, code, message, details);
      } else if (code === "GEMINI_REQUEST_FAILED") {
        sendJsonError(res, 502, requestId, code, message, details);
      } else if (code === "OPENAI_REQUEST_FAILED") {
        sendJsonError(res, 502, requestId, code, message, details);
      } else if (code === "EMPTY_MODEL_RESPONSE") {
        sendJsonError(res, 502, requestId, code, message, details);
      } else if (code === "MODEL_JSON_PARSE") {
        sendJsonError(res, 502, requestId, code, message, details);
      } else if (code === "RESPONSE_VALIDATION_FAILED") {
        sendJsonError(res, 502, requestId, code, message, details);
      } else {
        sendJsonError(res, 502, requestId, code, message, details);
      }
      return;
    }

    res.status(200).json(result.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error in ai-coach handler";
    logScan(requestId, "error", "unhandled", { message, stack: e instanceof Error ? e.stack : undefined });
    sendJsonError(res, 500, requestId, "UNHANDLED", message);
  }
}
