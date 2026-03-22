# NutriLog — agent memory (source of truth)

This file is the durable project memory for AI-assisted work. Update it when product scope, architecture, or major decisions change.

## Product summary

NutriLog is a **personal-use**, **mobile-first** **PWA** for nutrition and calorie logging, inspired by Cronometer/MacroFactor but **intentionally simpler** for MVP. It is **not** a medical or clinical product. Numbers and tips are **practical estimates** and must stay **non-medical**.

## Current status

- **Phase 1 (MVP)** implemented in-repo: onboarding, local-first storage (v2 with suggestion history), Today dashboard, manual food CRUD, scan flow (mocked AI), **Reports** with custom date range + suggestion history, Settings with **CSV/JSON export**, PWA, monorepo.

## MVP scope (Phase 1)

- Onboarding (nickname, email, goal, optional calorie target)
- `localStorage` persistence behind a storage service (v1→v2→**v3** migration; includes **suggestion snapshots** and **coach advice history**)
- Today dashboard: meals, totals, macros, target pacing, suggestions (snapshots saved for analysis), **AI coach** (LLM, max 2 requests per calendar date, requires ≥1 log line that day; messages persisted and exported)
- Manual logging (food or drink) with create/edit/delete
- Scan flow: **getUserMedia camera** or file upload → mock analysis → review → confirm (no auto-save)
- Settings: edit profile, **export report (JSON/CSV)** — versioned **`nutrilog-export`** (`schemaVersion: 3`) with `user`, `foodLogEntries` (includes **`itemCategory`**: food vs drink), `suggestionSnapshots`, **`coachAdvice`** (LLM summaries + input snapshot); CSV adds `SECTION:coach_advice`, clear all data
- **Reports** tab: default range **last 7 weeks (49 days)**, user-selectable **calendar range**, charts + **suggestion history** in range
- PWA installability (`vite-plugin-pwa`)
- Monorepo: `apps/web`, `apps/api` (placeholder), `packages/shared`

## Non-goals (still)

- Authentication, multi-user, cloud DB, barcode scan, cloud images, wearables, social, deep micronutrients, hydration, clinical advice, heavy backend infra.

## Stack

- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS 3, React Router 7, `vite-plugin-pwa`, Zod
- **Shared:** `@nutrilog/shared` — Zod schemas + date helpers + suggestion snapshot types
- **API:** `@nutrilog/api` — placeholder TypeScript package for Phase 2 serverless contracts
- **Persistence:** `localStorage` only (abstracted in `storageService.ts`)

## Deployment

- **Vercel:** Root `vercel.json` uses `outputDirectory: apps/web/dist`. If the Vercel **Root Directory** is set to `apps/web`, use `apps/web/vercel.json` and `outputDirectory: dist` — see `docs/vercel-deployment.md`.
- Keep handlers **edge/serverless-friendly** for later API routes; avoid tying to vendor-only APIs in app code.

## LLM / remote model usage (credits)

Only these **server** routes call an LLM (OpenAI or Gemini per **`FOOD_SCAN_PROVIDER`** / env keys). Everything else is **local** (rules, math, storage).

| Feature | Client | API | Uses image? |
|--------|--------|-----|-------------|
| **Scan meal** (vision estimate) | `ScanPage` → `aiScanService.ts` | **`POST /api/food-scan`** | Yes |
| **Auto-fill calories & macros** (manual entry) | `FoodFormPage` → `foodMacroEstimateService.ts` | **`POST /api/food-macro-estimate`** | No |
| **AI coach** | `CoachAdviceSection` → `coachAdviceService.ts` | **`POST /api/ai-coach`** | No |

**Not LLM-powered:** Today **Suggestions** (`suggestionEngine.ts` — on-device rules), **Reports** charts/aggregates, **export** JSON/CSV, onboarding, profile CRUD, pull-to-refresh.

## AI meal scan (vision)

- **Server:** `apps/web/api/food-scan.ts` (Vercel serverless) delegates to **`apps/web/server/food-scan/`** — **`openai.ts`** (OpenAI vision + JSON) or **`gemini.ts`** (Google Gemini vision + JSON). Same prompt in **`prompt.ts`** (food **and drinks**); response parsing in **`parseResponse.ts`**. Env: **`FOOD_SCAN_PROVIDER`** = unset/`openai` (needs **`OPENAI_API_KEY`**, optional **`OPENAI_MODEL`**) or **`gemini`**/`google` (needs **`GEMINI_API_KEY`**, optional **`GEMINI_MODEL`** — defaults to **`gemini-2.5-flash`**). Validates with `@nutrilog/shared` schemas. Use model IDs from Google’s docs; legacy **`gemini-1.5-flash`** may 404. Gemini quota `limit: 0` usually requires billing linked on the GCP project; see README troubleshooting.
- **Client:** `aiScanService.ts` posts base64 JSON to **`/api/food-scan`** (no keys in bundle). Set **`VITE_FOOD_SCAN_MOCK=true`** to force mock (no API cost). Camera uses **`getUserMedia`**.
- **Manual macro estimate:** `apps/web/api/food-macro-estimate.ts` + **`server/food-macro-estimate/run.ts`** — text-only JSON (same **`FOOD_SCAN_PROVIDER`** / keys as food-scan). **`FoodFormPage`** “Auto-fill calories & macros” calls **`foodMacroEstimateService.ts`**; optional **notes** go into the model prompt.
- **AI coach:** `apps/web/api/ai-coach.ts` + **`server/ai-coach/run.ts`** — text JSON summary (same provider keys as above).
- **Images:** never persist image bytes; only optional **metadata** on confirmed entries.

## UX principles

- Mobile-first, fast logging, calm “trusted app” feel, accessible labels, clear “estimate” language.

## Coding rules

- TypeScript + Zod at boundaries; shared schemas in `@nutrilog/shared`.
- Small files, small components, named functions where helpful.
- Handle storage parse/save failures with user-visible messages.

## Open questions

- Exact Vercel project layout once real API routes land (single vs multi project).
- Whether to add a minimal service worker update UX copy.

## Next steps (Phase 2)

1. Implement `POST` scan handler (likely in `apps/api` or `api/` for Vercel).
2. Strict JSON schema + Zod validation for model output.
3. Wire web client to server; keep provider interface.
4. Tune confidence/uncertainty copy based on real model scores.

## Known tradeoffs

- Suggestions use simple heuristics — good for MVP, not personalized coaching.
- Range averages divide by **number of days in the selected range** (days without entries count as 0 for calorie totals per day).
