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

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: "Server missing OPENAI_API_KEY. Add it in Vercel Project Settings → Environment Variables.",
    });
    return;
  }

  let rawBody: unknown = req.body;
  if (typeof rawBody === "string") {
    try {
      rawBody = JSON.parse(rawBody) as unknown;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const parsedBody = foodScanRequestBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body", details: parsedBody.error.flatten() });
    return;
  }

  const body = parsedBody.data;
  const model = resolveModel();

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

  try {
    const completion = await openai.chat.completions.create({
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

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      res.status(502).json({ error: "Empty model response" });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(extractJsonObject(raw));
    } catch {
      res.status(502).json({ error: "Model did not return valid JSON" });
      return;
    }

    const validated = foodScanApiResponseSchema.safeParse(json);
    if (!validated.success) {
      res.status(502).json({
        error: "Model JSON failed validation",
        details: validated.error.flatten(),
      });
      return;
    }

    res.status(200).json(validated.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    res.status(502).json({ error: message });
  }
}
