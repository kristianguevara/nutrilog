import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { MealType } from "@nutrilog/shared";
import { foodLogEntryDraftSchema } from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import { useAppState } from "@/providers/AppStateProvider.js";
import { estimateMacrosFromFood } from "@/services/foodMacroEstimateService.js";

const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function isMealType(v: string | null): v is MealType {
  return v === "breakfast" || v === "lunch" || v === "dinner" || v === "snack";
}

export function FoodFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { entries, addEntry, updateEntry, deleteEntry } = useAppState();

  const existing = mode === "edit" && id ? entries.find((e) => e.id === id) : undefined;

  const defaultDate = params.get("date") ?? formatLocalDateIso(new Date());
  const mealParam = params.get("meal");

  const initial = useMemo(() => {
    if (existing) {
      return {
        date: existing.date,
        time: existing.time,
        mealType: existing.mealType,
        foodName: existing.foodName,
        quantity: String(existing.quantity),
        unit: existing.unit,
        calories: String(existing.calories),
        protein: String(existing.protein),
        carbs: String(existing.carbs),
        fat: String(existing.fat),
        notes: existing.notes ?? "",
      };
    }
    const meal = isMealType(mealParam) ? mealParam : "snack";
    const now = new Date();
    return {
      date: defaultDate,
      time: formatLocalTimeIso(now),
      mealType: meal,
      foodName: "",
      quantity: "1",
      unit: "serving",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      notes: "",
    };
  }, [existing, defaultDate, mealParam]);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [mealType, setMealType] = useState<MealType>(initial.mealType);
  const [foodName, setFoodName] = useState(initial.foodName);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [unit, setUnit] = useState(initial.unit);
  const [calories, setCalories] = useState(initial.calories);
  const [protein, setProtein] = useState(initial.protein);
  const [carbs, setCarbs] = useState(initial.carbs);
  const [fat, setFat] = useState(initial.fat);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [assumptionsHint, setAssumptionsHint] = useState<string | null>(existing?.aiAssumptions ?? null);

  if (mode === "edit" && id && !existing) {
    return <Navigate to="/" replace />;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const q = Number(quantity);
    const c = Number(calories);
    const p = Number(protein);
    const cb = Number(carbs);
    const f = Number(fat);

    const parsed = foodLogEntryDraftSchema.safeParse({
      date,
      time,
      mealType,
      foodName: foodName.trim(),
      quantity: q,
      unit: unit.trim(),
      calories: c,
      protein: p,
      carbs: cb,
      fat: f,
      notes: notes.trim() === "" ? undefined : notes.trim(),
      sourceType: existing?.sourceType ?? "manual",
      aiConfidence: existing?.aiConfidence,
      aiAssumptions: assumptionsHint?.trim() || existing?.aiAssumptions,
      imageMetadata: existing?.imageMetadata,
    });

    if (!parsed.success) {
      setError("Please check your numbers — calories and macros must be 0 or higher.");
      return;
    }

    if (mode === "create") {
      addEntry(parsed.data);
    } else if (mode === "edit" && id) {
      updateEntry(id, parsed.data);
    }
    navigate(-1);
  }

  function onDelete() {
    if (!id) return;
    if (!window.confirm("Delete this entry?")) return;
    deleteEntry(id);
    navigate(-1);
  }

  async function onAutofillMacros() {
    setAutofillError(null);
    setError(null);
    const name = foodName.trim();
    if (!name) {
      setAutofillError("Enter a food name first.");
      return;
    }
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      setAutofillError("Enter a valid quantity greater than zero.");
      return;
    }
    const u = unit.trim();
    if (!u) {
      setAutofillError("Enter a unit (e.g. serving, cup, g).");
      return;
    }

    setAutofillLoading(true);
    try {
      const data = await estimateMacrosFromFood({
        foodName: name,
        quantity: q,
        unit: u,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setCalories(String(Math.round(data.calories)));
      setProtein(String(roundMacro(data.protein)));
      setCarbs(String(roundMacro(data.carbs)));
      setFat(String(roundMacro(data.fat)));
      setAssumptionsHint(data.assumptions?.trim() || null);
    } catch (e) {
      setAutofillError(e instanceof Error ? e.message : "Could not estimate macros.");
    } finally {
      setAutofillLoading(false);
    }
  }

  function roundMacro(n: number): number {
    return Math.round(n * 10) / 10;
  }

  function buildNutritionLookupQuery(): string {
    const name = foodName.trim();
    const q = quantity.trim();
    const u = unit.trim();
    const bits: string[] = [];
    if (q && u) bits.push(`${q} ${u}`);
    else if (q) bits.push(q);
    bits.push(name);
    const note = notes.trim();
    if (note) bits.push(note);
    return bits.join(" ");
  }

  function openNutritionixSearch(): void {
    setAutofillError(null);
    const query = buildNutritionLookupQuery().trim();
    if (!query) {
      setAutofillError("Enter a food name to search.");
      return;
    }
    const url = `https://www.nutritionix.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /** Google AI overviews often show ranges; kept as optional second lookup. */
  function openGoogleNutritionSearch(): void {
    setAutofillError(null);
    const query = buildNutritionLookupQuery().trim();
    if (!query) {
      setAutofillError("Enter a food name to search.");
      return;
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(`${query} calories protein carbs fat nutrition`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Food</p>
          <h1 className="text-2xl font-semibold text-slate-50">{mode === "create" ? "Add food" : "Edit food"}</h1>
        </div>
        <Link to="/" className="text-sm font-semibold text-slate-300 hover:text-white">
          Close
        </Link>
      </header>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="date">
                Date
                <RequiredMark />
              </label>
              <input
                id="date"
                name="date"
                type="date"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="time">
                Time
                <RequiredMark />
              </label>
              <input
                id="time"
                name="time"
                type="time"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={time}
                onChange={(ev) => setTime(ev.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="mealType">
              Meal
              <RequiredMark />
            </label>
            <select
              id="mealType"
              name="mealType"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={mealType}
              onChange={(ev) => setMealType(ev.target.value as MealType)}
            >
              {meals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="foodName">
              Food name
              <RequiredMark />
            </label>
            <input
              id="foodName"
              name="foodName"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={foodName}
              onChange={(ev) => {
                setFoodName(ev.target.value);
                setAssumptionsHint(null);
              }}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="quantity">
                Quantity
                <RequiredMark />
              </label>
              <input
                id="quantity"
                name="quantity"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={quantity}
                onChange={(ev) => setQuantity(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="unit">
                Unit
                <RequiredMark />
              </label>
              <input
                id="unit"
                name="unit"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={unit}
                onChange={(ev) => setUnit(ev.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="notes">
              Notes (optional)
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Extra detail for AI auto-fill — brand, how it&apos;s cooked, portion quirks, etc.
            </p>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              placeholder="e.g. Trader Joe’s, grilled, no oil…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!foodName.trim()}
              onClick={openNutritionixSearch}
            >
              Search Nutritionix (database)
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:text-slate-200"
              disabled={!foodName.trim()}
              onClick={openGoogleNutritionSearch}
            >
              Also open Google search
            </Button>
            <p className="text-xs text-slate-500">
              Nutritionix lists foods with <span className="text-slate-400">single per-serving numbers</span> you can tap
              through. Google may show AI text with ranges — for <span className="text-slate-400">one</span> estimate in
              NutriLog, use <span className="text-slate-400">Auto-fill</span> below (same AI as scan).
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={
                autofillLoading || !foodName.trim() || !quantity.trim() || !unit.trim()
              }
              onClick={() => void onAutofillMacros()}
            >
              {autofillLoading ? "Estimating…" : "Auto-fill calories & macros"}
            </Button>
            {autofillError ? <p className="text-sm text-rose-300">{autofillError}</p> : null}
            {assumptionsHint ? (
              <p className="text-xs leading-relaxed text-slate-400">
                <span className="font-medium text-slate-500">AI note:</span> {assumptionsHint}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="calories">
                Calories (kcal)
                <RequiredMark />
              </label>
              <input
                id="calories"
                name="calories"
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={calories}
                onChange={(ev) => setCalories(ev.target.value)}
                required
              />
            </div>
            <div />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="protein">
                Protein (g)
                <RequiredMark />
              </label>
              <input
                id="protein"
                name="protein"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={protein}
                onChange={(ev) => setProtein(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="carbs">
                Carbs (g)
                <RequiredMark />
              </label>
              <input
                id="carbs"
                name="carbs"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={carbs}
                onChange={(ev) => setCarbs(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="fat">
                Fat (g)
                <RequiredMark />
              </label>
              <input
                id="fat"
                name="fat"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={fat}
                onChange={(ev) => setFat(ev.target.value)}
                required
              />
            </div>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className="w-full">
            {mode === "create" ? "Save entry" : "Update entry"}
          </Button>

          {mode === "edit" ? (
            <Button type="button" variant="danger" className="w-full" onClick={onDelete}>
              Delete entry
            </Button>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
