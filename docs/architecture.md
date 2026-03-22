# Architecture

## Monorepo layout

```
apps/web      # PWA (Vite + React)
apps/api      # Placeholder for serverless / Phase 2 scan API
packages/shared
docs/
```

## Frontend (`apps/web`)

- **Routing:** React Router (`/`, `/report`, `/settings`, `/onboarding`, `/food/new`, `/food/:id/edit`, `/scan`)
- **State:** `AppStateProvider` loads/saves a single persisted snapshot: profile + entries
- **Services:**
  - `storageService` — `localStorage` + Zod parse/serialize
  - `foodLogService` — aggregations (per day, per meal)
  - `suggestionEngine` — deterministic rules
  - `analyticsService` — 7-day report
  - `aiScanService` — pluggable scan provider (mock for Phase 1)

## Shared (`packages/shared`)

- Zod schemas: `UserProfile`, `FoodLogEntry`, drafts, `imageMetadata`
- Date helpers for local `YYYY-MM-DD` / `HH:mm` handling

## API (`apps/api`)

- Phase 1 holds **types/contract notes** for the future scan endpoint.
- Phase 2 adds a handler that validates model JSON and returns draft entries.

## Persistence abstraction

`PersistedState` is versioned (`version: 1`). Swapping to IndexedDB or a remote API later should keep the same domain shapes and only replace `storageService`.

## PWA

`vite-plugin-pwa` generates the service worker and manifest. Icons use SVG (`public/icon.svg`) for simplicity; swap for PNGs if a store/browser requires it.

## Deployment (Vercel)

Root `vercel.json` builds `@nutrilog/shared` then `@nutrilog/web` and publishes `apps/web/dist`.
