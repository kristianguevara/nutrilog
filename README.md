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

**Local ports — why you see 3031 (and what to ignore)**

`vercel dev` always starts a **second** Vite process as part of the Vercel CLI (it expects a framework dev server). We pin that one to **3031** so it never fights your real dev server on **3030**. **You do not open http://localhost:3031** for day-to-day work — it is internal to `vercel dev`.

| Port | What | Open it? |
|------|------|----------|
| **3030** | Your NutriLog UI (`pnpm dev`) | **Yes** |
| **5173** | `vercel dev` — **`/api/food-scan`** etc. | **No** — the app on **3030** proxies `/api` here |
| **3031** | Vite subprocess spawned by `vercel dev` | **No** — ignore |

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

- **File:** `apps/web/api/food-scan.ts`
- **Role:** Accepts JSON (image as base64 + metadata + optional **user description**), calls **OpenAI** vision, returns structured JSON validated with `@nutrilog/shared`.

### Environment variables (never commit secrets)

**OpenAI keys for local development:** create and edit **`apps/web/.env.local`** (same directory as **`apps/web/.env.example`** — copy the example file, then fill in values). For deployed builds, set the same variable names in the **Vercel project’s Environment Variables** UI (not in the repo).

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENAI_API_KEY` | Vercel project env, or `apps/web/.env.local` for local serverless | Required for real scans |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini` in code; override if your account uses another vision model ID |
| `VITE_FOOD_SCAN_MOCK` | `apps/web/.env.local` only | `true` = browser uses mock scan (skips API) |

Copy **`apps/web/.env.example`** → **`apps/web/.env.local`** and fill in values.

### Run frontend + API locally

**Recommended: Vercel CLI** (runs serverless routes the same way as production).

1. Install the CLI: `npm i -g vercel` (or use `pnpm dlx vercel`).
2. Ensure **`apps/web/.env`** or **`apps/web/.env.local`** includes **`OPENAI_API_KEY=...`** (see **`.env.example`**).
3. From the **repository root**, run (API always on port **5173**):

   ```bash
   pnpm dev:api
   ```

   This runs **`scripts/dev-api-restart.mjs`**, which starts **`vercel dev --listen 5173`** and **automatically restarts** the CLI if it exits with an error (crash). **Ctrl+C** stops cleanly without looping. Example API URL: **http://127.0.0.1:5173/api/food-scan**.

**Troubleshooting:**

- **`.../apps/web/apps/web doesn't exist`:** You ran **`vercel dev`** from inside **`apps/web`** while the Vercel project uses **Root Directory = `apps/web`**. Run **`pnpm dev:api`** from the **repository root** (or `vercel dev --listen 5173` / `apps/web` as your link requires).

- **`Port 3030 is already in use` during `vercel dev`:** `vercel dev` starts its **own** Vite helper on **3031** (see root **`vercel.json`** `devCommand` and **`vite.config.ts`** when `VERCEL=1`). Keep **`pnpm dev`** on **3030** in the other terminal — do not run two plain `pnpm dev` on 3030.

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