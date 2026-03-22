# NutriLog

Personal, mobile-first nutrition logging PWA. See `agents.md` and `docs/` for product and architecture context.

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

Starts the Vite dev server (usually **http://localhost:5173**). This is the **React app only** by default.

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

There is **no separate Node/Express server**. The backend is a **Vercel serverless function**:

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
2. `cd apps/web`
3. Ensure `.env.local` exists with at least `OPENAI_API_KEY=...`
4. Run:

   ```bash
   vercel dev
   ```

   This starts a local dev server that includes **`/api/*`** routes. Open the URL the CLI prints (often **http://localhost:3000**).

**Using Vite (`pnpm dev`) while API runs on another port:** `vite.config.ts` proxies **`/api`** to **`http://127.0.0.1:3000`** by default (override with **`VITE_VERCEL_DEV_URL`** in `apps/web/.env.local` if your `vercel dev` port differs). Typical flow:

1. Terminal A: `cd apps/web && vercel dev` (note the port).
2. Terminal B: repo root `pnpm dev`, with proxy target matching terminal A (adjust `VITE_VERCEL_DEV_URL` if not `3000`).

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

## Packages

| Path | Role |
|------|------|
| `apps/web` | React PWA + **`api/`** Vercel serverless handlers |
| `apps/api` | Placeholder / types for future expansion |
| `packages/shared` | Zod schemas and shared utilities |
