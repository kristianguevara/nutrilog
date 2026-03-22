# NutriLog — agent memory (source of truth)

This file is the durable project memory for AI-assisted work. Update it when product scope, architecture, or major decisions change.

## Product summary

NutriLog is a **personal-use**, **mobile-first** **PWA** for nutrition and calorie logging, inspired by Cronometer/MacroFactor but **intentionally simpler** for MVP. It is **not** a medical or clinical product. Numbers and tips are **practical estimates** and must stay **non-medical**.

## Current status

- **Phase 1 (MVP)** implemented in-repo: onboarding, local-first storage, Today dashboard, manual food CRUD, scan flow (mocked AI), 7-day report, settings, PWA, monorepo.

## MVP scope (Phase 1)

- Onboarding (nickname, email, goal, optional calorie target)
- `localStorage` persistence behind a storage service (swappable later)
- Today dashboard: meals, totals, macros, target pacing, suggestions
- Manual food logging with create/edit/delete
- Scan flow: camera/upload → mock analysis → review → confirm (no auto-save)
- Settings: edit profile + clear all data
- 7-day report (averages, simple chart, insights)
- PWA installability (`vite-plugin-pwa`)
- Monorepo: `apps/web`, `apps/api` (placeholder), `packages/shared`

## Non-goals (still)

- Authentication, multi-user, cloud DB, barcode scan, cloud images, wearables, social, deep micronutrients, hydration, clinical advice, heavy backend infra.

## Stack

- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS 3, React Router 7, `vite-plugin-pwa`, Zod
- **Shared:** `@nutrilog/shared` — Zod schemas + small date helpers
- **API:** `@nutrilog/api` — placeholder TypeScript package for Phase 2 serverless contracts
- **Persistence:** `localStorage` only (abstracted in `storageService.ts`)

## Deployment

- **Primary target:** Vercel static build from `apps/web` (`vercel.json` at repo root).
- Keep handlers **edge/serverless-friendly** for later API routes; avoid tying to vendor-only APIs in app code.

## AI food scan

- **Phase 1:** Mock provider in `apps/web/src/services/aiScanService.ts` (swappable `FoodScanProvider`).
- **Phase 2 default model:** **GPT-5.4 mini** (vision) via server route; **never** ship API keys in the web bundle.
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
- 7-day averages treat non-logged days as zero calories in the average denominator (documented in UI).
