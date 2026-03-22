# NutriLog

Personal, mobile-first nutrition logging PWA (Phase 1 MVP). See `agents.md` and `docs/` for product and architecture context.

## Development

Requirements: Node 20+, pnpm 9+.

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Packages

- `apps/web` — React PWA
- `apps/api` — placeholder API package for Phase 2
- `packages/shared` — Zod schemas and shared utilities

## Deploy (Vercel)

The repository includes a root `vercel.json` targeting `apps/web/dist`. Connect the repo in Vercel and use the default install/build settings unless you customize the project.
