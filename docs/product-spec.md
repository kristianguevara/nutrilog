# NutriLog — product spec (MVP)

## Purpose

Help a single user answer, quickly and without friction:

- Calories by meal and for the day
- Protein / carbs / fat for the day
- Whether intake is roughly aligned with a stated goal
- A practical nudge for the rest of the day
- Patterns across a **user-selected date range** (default: **last 7 weeks**)
- **What suggestions were shown over time** (history stored for future analysis)

## Personas

- Primary: the owner (you), daily logging on a phone (desktop browser supported).

## Core screens

1. **Onboarding** — nickname, email, goal, optional calorie target; stored locally.
2. **Today** — meals, line items, meal/day totals, macro totals, target pacing, suggestion cards (snapshots saved), Add / Scan.
3. **Food form** — manual entry with validation; edit/delete.
4. **Scan** — **camera (browser permission / live preview)** or file upload → analysis → review → save (nothing saved without confirmation).
5. **Reports** — **calendar date range** (default 7 weeks), aggregates, bar chart, insights, **suggestion history** for the range.
6. **Settings** — profile fields; **export JSON/CSV** for a date range; clear local data.

## Data rules

- No image persistence; metadata only after explicit save.
- All nutrition numbers are **estimates** unless the user enters verified values.
- **Suggestion snapshots** store rule inputs + outputs (not medical advice).

## Out of scope (MVP)

See root `agents.md` non-goals.
