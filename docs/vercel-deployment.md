# Vercel deployment (NutriLog)

## What went wrong

Vercel reported: **“No Output Directory named `dist` found after the Build completed.”**

That happens when **where Vercel runs the build** and **where the static files land** do not match the **Output Directory** setting.

Common causes:

1. **Project “Root Directory” is `apps/web`**, but **Output Directory** is still `apps/web/dist` (wrong — from the app root it must be `dist`).
2. **Project “Root Directory” is the repository root**, but **Output Directory** is `dist` (wrong — the PWA build outputs to `apps/web/dist`).

## Fix (pick one)

### Option A — Monorepo root as Vercel root (recommended for pnpm workspaces)

In Vercel:

- **Root Directory:** leave empty or `.` (repository root).
- **Output Directory:** `apps/web/dist`  
  (or rely on the root `vercel.json` which sets this.)
- **Install command:** `pnpm install` (or as in root `vercel.json`).
- **Build command:** must build `@nutrilog/shared` then `@nutrilog/web` (see root `vercel.json`).

### Option B — `apps/web` as Vercel root

In Vercel:

- **Root Directory:** `apps/web`
- **Output Directory:** `dist`  
  (artifacts are written to `apps/web/dist` relative to the repo, which is `dist` relative to this root.)
- **Install command:** `cd ../.. && pnpm install`
- **Build command:** `cd ../.. && pnpm --filter @nutrilog/shared build && pnpm --filter @nutrilog/api build && pnpm --filter @nutrilog/web build`

Use `apps/web/vercel.json` for this layout.

## Files in this repo

| File | Purpose |
|------|---------|
| `/vercel.json` | Root-directory deploy: `outputDirectory: "apps/web/dist"` |
| `apps/web/vercel.json` | App-root deploy: `outputDirectory: "dist"` + `cd ../..` install/build |

After changing Root Directory, trigger a new deployment.
