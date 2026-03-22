/**
 * PHASE 2 — Server-side food scan contracts
 *
 * Intended flow:
 * - `apps/web` uploads an image to a route implemented here (or in `api/` at repo root for Vercel).
 * - The handler calls OpenAI (default: GPT-5.4 mini vision) with a strict JSON schema response.
 * - Responses are validated with Zod (reuse `@nutrilog/shared` schemas where possible).
 * - Never persist raw image bytes; optionally persist only `imageMetadata` on the client after confirm.
 */

import type { FoodLogEntryDraft } from "@nutrilog/shared";

export interface FoodScanRequestMeta {
  /** ISO datetime */
  requestedAt: string;
}

export interface FoodScanModelResult {
  items: Array<{
    draft: FoodLogEntryDraft;
    confidence: number;
    assumptions: string;
  }>;
}

export type FoodScanProviderName = "openai" | "mock";

export interface FoodScanProviderConfig {
  name: FoodScanProviderName;
  /** PHASE 2: set via environment on the server, never in the web bundle */
  apiKey?: string;
  /** PHASE 2: default model identifier for OpenAI */
  model?: string;
}
