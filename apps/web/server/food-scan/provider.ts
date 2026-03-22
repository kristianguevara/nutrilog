export type FoodScanProviderId = "openai" | "gemini";

/** Default `openai`. Set `FOOD_SCAN_PROVIDER=gemini` (or `google`) to use Google Gemini. */
export function resolveFoodScanProvider(): FoodScanProviderId {
  const p = process.env.FOOD_SCAN_PROVIDER?.trim().toLowerCase();
  if (p === "gemini" || p === "google") return "gemini";
  return "openai";
}
