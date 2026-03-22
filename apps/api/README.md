# NutriLog API (placeholder)

This package is intentionally small for Phase 1. It exists to:

- Reserve a clean place for **Vercel serverless / edge** handlers.
- Hold **Phase 2** contracts for the food-photo scan pipeline (GPT-5.4 mini by default).
- Share validation types with `@nutrilog/shared`.

## Phase 2 plan

- Add a `POST /food-scan` (or similar) handler.
- Accept multipart uploads; **do not store** image bytes long-term.
- Return structured draft entries validated with Zod.
- Keep provider + model selection behind a small interface so vendors can be swapped.

## Deployment notes

You can deploy the PWA from `apps/web` today. When API routes are added, either:

- Create a second Vercel project with root directory `apps/api`, **or**
- Add `api/` routes under the same project using Vercel’s filesystem routing conventions.

Keep secrets in environment variables on the server only.
