# Roadmap

## Phase 1 — MVP (done)

- Monorepo, shared Zod schemas, PWA, onboarding, Today, manual CRUD, mock scan review flow, 7-day report, settings, local storage service.

## Phase 2 — Smart logging

- Real GPT-5.4 mini (vision) integration behind a server route
- Provider abstraction retained; secrets on server only
- Strong validation and uncertainty UX

## Phase 3 — Better nutrition UX

- Recents, favorites, duplicate meal, templates, richer charts

## Phase 4 — Cronometer-inspired depth

- Micronutrients, hydration, barcode, custom foods/recipes

## Phase 5 — MacroFactor-inspired coaching

- Weight/body metrics, adaptive coaching, stronger trends

## Phase 6 — Optional expansion

- Backend DB, accounts, sync, export/import

### Database hosting (MySQL-first, free to start)

**Findings (short):** PlanetScale’s **free Hobby tier is gone** (2024); don’t plan on it for $0. For **real MySQL** with minimal ops, good starting points are:

| Option | Notes |
|--------|--------|
| **[Aiven](https://aiven.io)** | Often cited **free MySQL** tier (small VM, ~1 GB storage, good for prototypes). Check current [Aiven pricing](https://aiven.io/pricing) / docs for regions and whether a card is required. |
| **Oracle Cloud “Always Free”** | **MySQL HeatWave** (and other services) can be $0 on the always-free allowance; **more setup** (account, networking, security lists). Good if you want a long-lived free VM-style DB. |
| **Self-host MySQL** on a **free VPS** (Oracle, Fly.io, etc.) | **$0** but **you** patch, backup, and secure it. |

**If you can use Postgres instead of MySQL:** **Neon**, **Supabase**, and **Railway** are very popular for **quick + free/cheap** tiers and pair well with serverless (Vercel). NutriLog can still map the same tables; only SQL dialect and drivers change.

**Recommendation for NutriLog:** Prefer a **managed** DB (Aiven or Neon/Supabase) over self-hosting until you need MySQL-specific features. Keep **connection strings in Vercel env**, use **SSL**, and plan **migrations** (e.g. Drizzle/Prisma/Flyway) before pointing production traffic at it.
