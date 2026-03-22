import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { MealType } from "@nutrilog/shared";
import { foodLogEntryDraftSchema } from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { useAppState } from "@/providers/AppStateProvider.js";

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
      aiAssumptions: existing?.aiAssumptions,
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
            </label>
            <input
              id="foodName"
              name="foodName"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={foodName}
              onChange={(ev) => setFoodName(ev.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="quantity">
                Quantity
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="calories">
                Calories (kcal)
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

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
            />
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
