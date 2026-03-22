# NutriLog — refined one-shot product / build prompt

Use this as the canonical spec for future greenfield or major rebuild sessions. It merges the original MVP vision with post-build feedback.

---

Build **NutriLog** — a personal-use, mobile-first nutrition and calorie tracking **Progressive Web App (PWA)**, inspired by **Cronometer** and **MacroFactor**, but intentionally much simpler for the MVP.

This app is for **my own personal use first**. The primary goal is to make daily food logging **fast and practical**, help me understand **calories and basic healthy parameters**, and provide **simple analysis over time** plus **durable data** for future smarter analysis.

**Key outcomes the app must help me answer:**

- How many calories did I consume for **breakfast, lunch, dinner, and snacks**?
- How many calories have I consumed **today** in total?
- What are my current **protein, carbs, and fat** totals?
- Am I **on track** for my goal (lose weight / maintain / gain)?
- What **simple adjustment** should I make for the **rest of the day**?
- What **patterns** do I see across a **user-selected date range** (Reports default: **last 7 days**)?
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
5. **Reports** screen: **default range = last 7 days**, user can pick **any inclusive calendar date range**; calories-by-day list **newest first**; filters apply **immediately** (no Apply button)  
6. **Suggestion history** visible in Reports for the selected range (read from storage)  
7. **Settings:** profile edit, **download export** (CSV or JSON) for a **date range** (defaults: first logged date → last logged date), **clear local data**  
8. **Scan food:** **real camera** via **`getUserMedia`** on supported browsers; **upload** as separate path; **server-side** OpenAI vision via **`POST /api/food-scan`**; mock via **`VITE_FOOD_SCAN_MOCK=true`** for offline dev  
9. PWA installability  
10. **Local-first persistence** with a **versioned** storage model and migration path  
11. Monorepo: `apps/web` (PWA + Vercel `api/`), `apps/api` (optional placeholder), `packages/shared`  
12. Memory/docs: `agents.md`, `docs/*`, Cursor rules, **`one-shot-prompt.md`**  

**Explicitly out of MVP:** auth, multi-user, cloud DB, barcode, cloud image storage, wearables, social, deep micronutrients, hydration, advanced coaching, medical advice, heavy infra.

---

## PLATFORM / ARCHITECTURE

- **Stack:** React, Vite, TypeScript, Tailwind CSS, `vite-plugin-pwa`, Zod  
- **Monorepo:** `apps/web` (PWA + serverless `api/`), `packages/shared` (schemas + utilities)  
- **Persistence:** `localStorage` (or abstract storage) for MVP; design so a backend can replace it later  
- **Deployment:** **Vercel**-friendly; document **two valid layouts**: repo root with `outputDirectory: apps/web/dist`, **or** Vercel root `apps/web` with `outputDirectory: dist` and install/build from monorepo root — avoid “missing `dist`” misconfiguration  
- **Image handling:** never persist raw food photos; optional **metadata** only (filename, mimeType, size, uploadedAt, sourceMethod)  
- **AI scan (server):** `OPENAI_API_KEY` + optional `OPENAI_MODEL` on Vercel; default **gpt-4o-mini** vision-capable unless overridden (e.g. when **gpt-5.4-mini** is available to your account). **Never** commit API keys.  

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
3. **Scan** — camera (getUserMedia) **or** file upload → **server vision** → **review** → save; no auto-save; no image persistence.  
4. **Reports** — pick date range (default **7 days**), show aggregates, chart, insights, and **suggestion history** in range.  
5. **Settings** — profile; **export JSON/CSV** for chosen range; clear data.  

---

## ENGINEERING RULES

- TypeScript + Zod at boundaries; shared schemas in `packages/shared`  
- Small modules: storage, food math, suggestions, analytics, AI scan adapter, export helpers  
- Handle corrupt storage and show recovery/reset paths  
- Mobile-first, accessible forms  
- No unnecessary dependencies  

---

## PHASES (abbreviated)

- **Phase 1:** MVP above  
- **Phase 2:** Serverless food-scan + OpenAI vision + JSON validation — **implemented** (`apps/web/api/food-scan.ts`)  
- **Phase 3+:** UX depth (recents, favorites, templates, richer charts)  
- **Later:** optional backend/sync/accounts only if needed  

---

## OUTPUT EXPECTATIONS FOR AN AGENT RUN

1. Short implementation plan  
2. Repo + shared schemas + migrations  
3. Working web app + PWA  
4. Vercel config **documented for both root-directory strategies**  
5. Update `agents.md` / `docs` when behavior changes  
6. Deliver **summary, assumptions, and Phase 2 next steps**  

---

*End of refined prompt.*
