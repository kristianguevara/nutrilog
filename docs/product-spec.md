# NutriLog — product spec (MVP)

## Purpose

Help a single user answer, quickly and without friction:

- Calories by meal and for the day
- Protein / carbs / fat for the day
- Whether intake is roughly aligned with a stated goal
- A practical nudge for the rest of the day
- Simple 7-day patterns

## Personas

- Primary: the owner (you), daily logging on a phone.

## Core screens

1. **Onboarding** — nickname, email, goal, optional calorie target; stored locally.
2. **Today** — meals, line items, meal/day totals, macro totals, target pacing, suggestion cards, Add / Scan.
3. **Food form** — manual entry with validation; edit/delete.
4. **Scan** — pick/capture image → analysis → review → save (nothing saved without confirmation).
5. **Week report** — last 7 local days; averages; simple bar visualization; insights.
6. **Settings** — profile fields + clear local data.

## Data rules

- No image persistence; metadata only after explicit save.
- All nutrition numbers are **estimates** unless the user enters verified values.

## Out of scope (MVP)

See root `agents.md` non-goals.
