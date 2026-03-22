# NutriLog

Personal, mobile-first nutrition logging PWA. See `agents.md` and `docs/` for product and architecture context.

## Quick run (real food scan API locally)

There is **no separate backend process** (no Express, no long‑running server). **`POST /api/food-scan`** is implemented only as a **Vercel serverless function**. Locally, that route runs when you use the **Vercel CLI**:

- **Terminal 1** (repo root): `pnpm dev:api` — **`vercel dev --listen 5173`** (run from the **repository root**; see troubleshooting if paths fail). Listens on **5173** for **`/api/*`**.
- **Terminal 2** (repo root): `pnpm dev` — runs **`scripts/dev-frontend-restart.mjs`** (Vite via **`pnpm --filter @nutrilog/web dev`**), which **restarts** the dev server if it crashes. App: **http://localhost:3030**; **proxies** `/api` to **5173**. **Open the app here** in the browser.

**Run both (from the repo root, after `pnpm install`):**

| Step | Terminal | Command | URL |
|------|----------|---------|-----|
| 1 | First | `pnpm dev:api` | **5173** — serverless API (see table below) |
| 2 | Second | `pnpm dev` | **http://localhost:3030** — **use this in the browser** |

Start **`pnpm dev:api` first** so `/api` is up before you scan.

**Local ports — internal Vite under `vercel dev`**

`vercel dev` starts a **second** Vite process (framework dev server). Vercel assigns it a **dynamic** `PORT` (not fixed). **You do not open that URL** for day-to-day work — it is internal. Your browser uses **3030** only.

| Port | What | Open it? |
|------|------|----------|
| **3030** | Your NutriLog UI (`pnpm dev`) | **Yes** |
| **5173** | `vercel dev` — **`/api/food-scan`** etc. | **No** — the app on **3030** proxies `/api` here |
| **(dynamic)** | Vite subprocess spawned by `vercel dev` | **No** — ignore |

**One terminal only?** For **real** scans you need **both** commands (two terminals). **One terminal** is enough only if you add **`VITE_FOOD_SCAN_MOCK=true`** to **`apps/web/.env`** / **`.env.local`** and run **`pnpm dev`** alone (mock scan, no OpenAI).

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (e.g. `corepack enable` then `corepack prepare pnpm@9.14.4 --activate`)

## Install

From the **repository root**:

```bash
pnpm install
```

This links the monorepo (`packages/shared`, `apps/web`, `apps/api`).

---

## Frontend (Vite PWA)

From the **repository root**:

```bash
pnpm dev
```

Runs **`scripts/dev-frontend-restart.mjs`**, which starts **`pnpm --filter @nutrilog/web dev`** (Vite) and **restarts automatically** if the process exits with an error (same idea as **`pnpm dev:api`**). **Ctrl+C** exits without looping. The dev server is on **http://localhost:3030** (see `vite.config.ts`; **`vercel dev`** uses **5173** when **`pnpm dev:api`** runs). **React app only** by default.

- **Food scan:** the UI calls **`POST /api/food-scan`** (relative URL). In plain `pnpm dev`, that route is **not** served by Vite unless you proxy to a backend (see below) or use **mock scan**.
- **Mock scan (no backend, no OpenAI):** create `apps/web/.env.local`:

  ```bash
  VITE_FOOD_SCAN_MOCK=true
  ```

  Then `pnpm dev` again — scan uses local mock data.

Other useful commands from the repo root:

```bash
pnpm build    # build shared + api package + web (Vite production bundle)
pnpm preview  # serve the production build (after build)
```

---

## Backend (food-scan API)

There is **no separate Node/Express server**. The only “backend” for scanning is a **Vercel serverless function**. **`pnpm dev` (Vite) does not execute that code** — for a real scan locally run **`pnpm dev:api`** from the **repo root** (see below). In **production**, Vercel runs the same function on **`POST /api/food-scan`**.

- **File:** `apps/web/api/food-scan.ts` (handlers in **`apps/web/server/food-scan/`** — OpenAI and Gemini wrappers)
- **Role:** Accepts JSON (image as base64 + metadata + optional **user description**), calls **OpenAI** or **Google Gemini** vision (see env below), returns structured JSON validated with `@nutrilog/shared`.

### Environment variables (never commit secrets)

**API keys for local development:** create and edit **`apps/web/.env.local`** (same directory as **`apps/web/.env.example`** — copy the example file, then fill in values). For deployed builds, set the same variable names in the **Vercel project’s Environment Variables** UI (not in the repo).

| Variable | Where | Purpose |
|----------|--------|---------|
| `FOOD_SCAN_PROVIDER` | Optional | Omit or `openai` (default) — use **`gemini`** or **`google`** for Google Gemini |
| `OPENAI_API_KEY` | Vercel env, or `apps/web/.env.local` | Required when provider is OpenAI (default) |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini` in code; override if your account uses another vision model ID |
| `GEMINI_API_KEY` | Vercel env, or `apps/web/.env.local` | Required when **`FOOD_SCAN_PROVIDER=gemini`** (get a key at [Google AI Studio](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | Optional | Defaults to **`gemini-2.5-flash`** (matches current API model IDs). Legacy names like `gemini-1.5-flash` may return **404**; use names from [Gemini models](https://ai.google.dev/gemini-api/docs/models) (e.g. `gemini-2.5-flash-lite`) |
| `VITE_FOOD_SCAN_MOCK` | `apps/web/.env.local` only | `true` = browser uses mock scan (skips API) |

Copy **`apps/web/.env.example`** → **`apps/web/.env.local`** and fill in values.

### Run frontend + API locally

**Recommended: Vercel CLI** (runs serverless routes the same way as production).

1. Install the CLI: `npm i -g vercel` (or use `pnpm dlx vercel`).
2. Ensure **`apps/web/.env`** or **`apps/web/.env.local`** includes **`OPENAI_API_KEY=...`** for OpenAI, or **`FOOD_SCAN_PROVIDER=gemini`** and **`GEMINI_API_KEY=...`** for Gemini (see **`.env.example`**).
3. From the **repository root**, run (API always on port **5173**):

   ```bash
   pnpm dev:api
   ```

   This runs **`scripts/dev-api-restart.mjs`**, which starts **`vercel dev --listen 5173`** and **automatically restarts** the CLI if it exits with an error (crash). **Ctrl+C** stops cleanly without looping. Example API URL: **http://127.0.0.1:5173/api/food-scan**.

**Troubleshooting:**

- **`.../apps/web/apps/web doesn't exist`:** You ran **`vercel dev`** from inside **`apps/web`** while the Vercel project uses **Root Directory = `apps/web`**. Run **`pnpm dev:api`** from the **repository root** (or `vercel dev --listen 5173` / `apps/web` as your link requires).

- **`Port 3030 is already in use` during `vercel dev`:** Keep **`pnpm dev`** on **3030** in the other terminal — do not run two plain `pnpm dev` on 3030. If **`vercel dev` restarts** and you see a port-in-use error for the **child** Vite, a previous process may still be bound — stop **`pnpm dev:api`**, kill stray `node`/`vite` processes if needed, then start again.

- **Gemini `404` / `GEMINI_MODEL_NOT_FOUND`:** The model ID in **`GEMINI_MODEL`** is wrong or **retired** (e.g. `gemini-1.5-flash` may not exist on the current API). Use a current ID from [Gemini models](https://ai.google.dev/gemini-api/docs/models); the app default is **`gemini-2.5-flash`**.

- **Gemini `429` / `limit: 0` / `GEMINI_QUOTA_EXCEEDED`:** Google often allocates **no free-tier quota** until you **link a billing account** to the **Google Cloud project** that owns the API key (you may still get free monthly usage). In [Google Cloud Console](https://console.cloud.google.com/) → select the project tied to your key → **Billing** → link an account. Also confirm **Generative Language API** is enabled. If your [AI Studio limits](https://aistudio.google.com/) show quota for **Gemini 2.5 Flash** but not **Gemini 2 Flash**, set **`GEMINI_MODEL`** accordingly. Official: [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

**Using Vite (`pnpm dev`) with the API:** `vite.config.ts` proxies **`/api`** to **`http://127.0.0.1:5173`** by default. Override with **`VITE_VERCEL_DEV_URL`** in `apps/web/.env` / `.env.local` only if you change the listen port. Typical flow:

1. Terminal A: repo root **`pnpm dev:api`** (API on **5173**).
2. Terminal B: repo root **`pnpm dev`** (app on **http://localhost:3030**).

If you only need the UI without calling OpenAI, use **`VITE_FOOD_SCAN_MOCK=true`** and a single `pnpm dev` is enough.

---

## Deploy (Vercel)

See **`docs/vercel-deployment.md`**. Summary:

- **Vercel project root = repo root:** root **`vercel.json`** — output **`apps/web/dist`**.
- **Vercel project root = `apps/web`:** **`apps/web/vercel.json`** — output **`dist`**.

Set **`OPENAI_API_KEY`** (and optionally **`OPENAI_MODEL`**) in the Vercel project’s environment variables.

### Food scan notes

- **Never** commit API keys. Rotate any key that was ever exposed in chat or a public repo.
- Default model in server code is **`gpt-4o-mini`** (vision-capable); set **`OPENAI_MODEL`** if your account uses a different ID.

---

## Install the PWA on your phone

PWAs install from the **browser** after you open the deployed site over **HTTPS** (your Vercel URL). **localhost** on a desktop is fine for development; installing on a phone usually means opening the **same deployed URL** (or a tunnel such as ngrok) because mobile Safari/Chrome expect a normal origin.

### iPhone / iPad (Safari)

1. Open the app URL in **Safari** (not Chrome-only if you want the standard iOS install path).
2. Tap the **Share** button (square with arrow).
3. Scroll and tap **Add to Home Screen**.
4. Edit the name if you like, then tap **Add**. The icon opens the app in standalone mode (full screen, no Safari UI).

### Android (Chrome)

1. Open the app URL in **Chrome**.
2. Tap the **⋮** menu (or look for an **Install app** / **Add to Home screen** banner).
3. Confirm **Install** or **Add**. The launcher icon opens the PWA like a regular app.

### Notes

- **HTTPS** is required for service workers and install prompts on real devices; Vercel deployments satisfy this.
- If you do not see an install option, ensure you are not in **private/incognito** mode, and try **Add to Home Screen** from the browser menu even when no banner appears.
- After a new deploy, the PWA may **update** on next visit; `vite-plugin-pWA` is set to **auto-update** in this project.

---

## Packages

| Path | Role |
|------|------|
| `apps/web` | React PWA + **`api/`** Vercel serverless handlers |
| `apps/api` | Placeholder / types for future expansion |
| `packages/shared` | Zod schemas and shared utilities |