export interface FoodScanLogger {
  logStep: (requestId: string, line: string) => void;
  logScan: (requestId: string, level: "info" | "error", message: string, meta?: Record<string, unknown>) => void;
}

export type FoodScanModelResult =
  | { ok: true; rawText: string }
  | {
      ok: false;
      code:
        | "OPENAI_REQUEST_FAILED"
        | "GEMINI_REQUEST_FAILED"
        | "GEMINI_QUOTA_EXCEEDED"
        | "GEMINI_MODEL_NOT_FOUND"
        | "EMPTY_MODEL_RESPONSE";
      message: string;
      details?: Record<string, unknown>;
    };
