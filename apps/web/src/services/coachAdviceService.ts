import { coachAdviceResponseSchema, type CoachAdviceRequest } from "@nutrilog/shared";

export async function requestCoachAdvice(body: CoachAdviceRequest): Promise<{ summary: string }> {
  const res = await fetch("/api/ai-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = payload as { error?: string; code?: string; requestId?: string };
    const msg = err.error ?? `Coach request failed (${res.status})`;
    const code = err.code ? ` [${err.code}]` : "";
    const ref = err.requestId ? ` Ref: ${err.requestId}` : "";
    throw new Error(`${msg}${code}${ref}`);
  }

  const validated = coachAdviceResponseSchema.safeParse(payload);
  if (!validated.success) {
    throw new Error("Coach response was not valid.");
  }
  return validated.data;
}
