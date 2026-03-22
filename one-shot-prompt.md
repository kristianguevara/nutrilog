# One-shot product / build prompt (template + NutriLog spec)

Use this document in **any** greenfield session where you want a **single prompt** to drive most of the build: product intent, architecture, env layout, security, local dev, deploy, and docs. Replace *NutriLog*-specific sections when cloning the pattern for another app.

---

## How to use this in another project

1. Copy the **PORTABLE CHECKLIST** (below) into your new repo’s spec or first agent message.
2. Swap product name, screens, and data model; keep the **monorepo + Vite + serverless API + shared Zod** pattern if it fits.
3. Require a **README** that names **exact directories** for env files and commands for frontend vs backend.

---

## PORTABLE CHECKLIST (env, secrets, local dev)

### Where API keys live (never commit secrets)

| What | Directory / place | Notes |
|------|-------------------|--------|
| **Local serverless + OpenAI** | **`apps/web/.env.local`** | Create by copying **`apps/web/.env.example`**. Put **`OPENAI_API_KEY`** and optional **`OPENAI_MODEL`** here for `vercel dev`. |
| **Production / preview** | **Vercel project → Settings → Environment Variables** | Same variable names: **`OPENAI_API_KEY`**, optional **`OPENAI_MODEL`**. |
| **Browser-only flags** | **`apps/web/.env.local`** | Prefix **`VITE_`** (e.g. **`VITE_FOOD_SCAN_MOCK=true`**) — these are exposed to the client bundle; **never** put the OpenAI key in a `VITE_` variable. |

**Rule:** Only **`OPENAI_*`** (no `VITE_` prefix) in server code; validate bodies with Zod; rotate any key that was pasted in chat or committed by mistake.

### Commands (typical monorepo)

| Goal | From | Command |
|------|------|---------|
| Install | **repository root** | `pnpm install` |
| Frontend only (Vite) | **repository root** | `pnpm dev` — often **http://localhost:5173** |
| Serverless routes + OpenAI locally | **`apps/web`** | `vercel dev` — often **http://localhost:3000**; ensures **`/api/*`** works like production |
| Frontend + API in two terminals | Terminal A: **`cd apps/web && vercel dev`**; Terminal B: **repo root `pnpm dev`** | Point Vite’s **`/api` proxy** at `vercel dev` (default **`http://127.0.0.1:3000`**); override with **`VITE_VERCEL_DEV_URL`** in **`apps/web/.env.local`** if the port differs |
| No backend / no key | **`apps/web/.env.local`** | `VITE_FOOD_SCAN_MOCK=true` then `pnpm dev` only |

### Docs the agent must deliver

- **README at repo root:** prerequisites, install, **how to run frontend**, **how to run backend (serverless)**, **exact path** to **`apps/web/.env.example`** → **`.env.local`**, deploy env on Vercel, and a line that keys are **never** committed.
- **`apps/web/.env.example`:** commented placeholders for **`OPENAI_*`**, mock flag, and proxy URL.
- Optional: **`agents.md`**, **`docs/*`**, Cursor rules — keep in sync when behavior changes.

### API pattern for “AI from image”

- **Route:** e.g. **`POST /api/<name>`** as a file under **`apps/web/api/`** (Vercel serverless).
- **Body:** JSON with base64 image + optional **`userDescription`** (trimmed, max length in Zod) to enrich the model prompt; return structured JSON validated with **`packages/shared`** schemas.
- **Client:** adapter service; map results to your domain model; optional description stored as **notes** or similar on draft/saved entries.

---

# NutriLog — product spec (example filled in)

Build **NutriLog** — a personal-use, mobile-first nutrition and calorie tracking **Progressive Web App (PWA)**, inspired by **Cronometer** and **MacroFactor**, but intentionally much simpler for the MVP.

This app is for **my own personal use first**. The primary goal is to make daily food logging **fast and practical**, help me understand **calories and basic healthy parameters**, and provide **simple analysis over time** plus **durable data** for future smarter analysis.

**Key outcomes the app must help me answer:**

- How many calories did I consume for **breakfast, lunch, dinner, and snacks**?
- How many calories have I consumed **today** in total?
- What are my current **protein, carbs, and fat** totals?
- Am I **on track** for my goal (lose weight / maintain / gain)?
- What **simple adjustment** should I make for the **rest of the day**?
- What **patterns** do I see across a **user-selected date range** (Reports default: **last 7 days**; user can pick any inclusive range)?
- What **recommendations were shown over time** (history), so future models can learn from **inputs + outputs**?

This is **not** a medical or clinical app. Nutrition estimates and suggestions must be **practical, conservative**, and clearly labeled as **estimates** where applicable.

---

## PRODUCT DIRECTION

Use Cronometer and MacroFactor as inspiration for:

- Food logging quality and nutrition visibility  
- Daily and **range** analysis  
- Trusted-feeling UI, editable entries, goal awareness  

Do **not** recreate their full feature scope in the initial build. The MVP must stay **lightweight and usable**.

---

## MVP SCOPE (must ship)

1. Lightweight onboarding  
2. Manual food logging (full CRUD)  
3. Daily dashboard (meals, totals, macros, target pacing)  
4. **Rules-based suggestions** on Today, with **persisted suggestion history** (per snapshot: date, timestamp, input totals, suggestion text) for future intelligence  
5. **Reports** screen: **default date range = last 7 days** (inclusive), user can pick **any inclusive calendar date range**; **Calories by day** sorted **newest first**; changing dates updates the report **immediately** (no Apply button)  
6. **Suggestion history** visible in Reports for the selected range (read from storage)  
7. **Settings:** profile edit, **download export** (CSV or JSON) for a **date range** (defaults: first logged date → last logged date), **clear local data**  
8. **Scan food:** **real camera** via **`getUserMedia`** on supported browsers (not only `<input capture>`); **upload** as separate path; **server-side** OpenAI vision via **`POST /api/food-scan`** (JSON: base64 image + optional **`userDescription`** for richer prompts and optional **notes** on saved lines); **never** ship API keys in the client; optional **`VITE_FOOD_SCAN_MOCK=true`** in **`apps/web/.env.local`** for offline mock  
9. PWA installability  
10. **Local-first persistence** with a **versioned** storage model and migration path  
11. Monorepo: **`apps/web`** (PWA + Vercel serverless **`api/`**), **`apps/api`** (optional placeholder package), **`packages/shared`**  
12. Memory/docs: **`agents.md`**, **`docs/*`**, Cursor rules, **`one-shot-prompt.md`** (this file)  

**Explicitly out of MVP:** auth, multi-user, cloud DB, barcode, cloud image storage, wearables, social, deep micronutrients, hydration, advanced coaching, medical advice, heavy infra.

---

## PLATFORM / ARCHITECTURE

- **Stack:** React, Vite, TypeScript, Tailwind CSS, `vite-plugin-pwa`, Zod  
- **Monorepo:** **`apps/web`** (PWA + **`api/*.ts`** on Vercel), **`packages/shared`** (schemas + utilities)  
- **Persistence:** `localStorage` (or abstract storage) for MVP; design so a backend can replace it later  
- **Deployment:** Vercel-friendly; document **two valid layouts**: repo root with `outputDirectory: apps/web/dist`, **or** Vercel root **`apps/web`** with `outputDirectory: dist` and install/build from monorepo root — avoid “missing `dist`” misconfiguration  
- **Image handling:** never persist raw food photos; optional **metadata** only (filename, mimeType, size, uploadedAt, sourceMethod)  
- **AI scan (server):** **`OPENAI_API_KEY`** and optional **`OPENAI_MODEL`** only in **server** env — **`apps/web/.env.local`** for local **`vercel dev`**, Vercel dashboard for deploy. Default model in code may be **`gpt-4o-mini`** (vision); override **`OPENAI_MODEL`** when your account exposes a different ID — **never** commit secrets  

---

## DATA MODEL (extend as needed)

**UserProfile:** nickname, email, goalType, optional dailyCalorieTarget, createdAt, updatedAt  

**FoodLogEntry:** id, date, time, mealType, foodName, quantity, unit, calories, protein, carbs, fat, notes, sourceType, optional ai fields, optional imageMetadata, createdAt, updatedAt  

**SuggestionSnapshot (persisted):** id, date (calendar day), generatedAt (ISO), **inputSnapshot** (day calories/macros + entry count), **suggestions** (id, tone, title, body) — dedupe identical consecutive snapshots if practical  

**Storage:** versioned document (e.g. v2) with profile, entries, `suggestionHistory[]`; migrate from prior versions.

---

## USER FLOWS (high level)

1. **Today** — meal sections, totals, macros, target progress, suggestion cards, Add food, Scan food; **persist suggestion snapshots** when the Today view computes suggestions (dedupe identical snapshots).  
2. **Manual food** — validated fields; edits propagate to totals, reports, and future suggestions.  
3. **Scan** — camera (getUserMedia) **or** file upload → optional **description** field (improves AI prompt) → **server vision API** → **review** → save; no auto-save; no image persistence.  
4. **Reports** — pick date range (default **7 days**), show aggregates, chart (calories by day **newest first**), insights, and **suggestion history** in range.  
5. **Settings** — profile; **export JSON/CSV** for chosen range; clear data.  

---

## ENGINEERING RULES

- TypeScript + Zod at boundaries; shared schemas in **`packages/shared`**  
- Small modules: storage, food math, suggestions, analytics, AI scan adapter, export helpers  
- Handle corrupt storage and show recovery/reset paths  
- Mobile-first, accessible forms  
- No unnecessary dependencies  

---

## PHASES (abbreviated)

- **Phase 1:** MVP above  
- **Phase 2 (partial):** Serverless food-scan route + OpenAI vision + JSON; keys server-only — implemented in **`apps/web/api/food-scan.ts`**  
- **Phase 3+:** UX depth (recents, favorites, templates, richer charts)  
- **Later:** optional backend/sync/accounts only if needed  

---

## OUTPUT EXPECTATIONS FOR AN AGENT RUN

1. Short implementation plan  
2. Repo + shared schemas + migrations  
3. Working web app + PWA  
4. Vercel config **documented for both root-directory strategies**  
5. **README** with **directory-precise** env setup (**`apps/web/.env.local`**, **`apps/web/.env.example`**, Vercel env) and **frontend vs `vercel dev`** instructions  
6. Update **`agents.md`** / **`docs`** when behavior changes  
7. Deliver **summary, assumptions, and next steps**  

---

*End of one-shot prompt.*
