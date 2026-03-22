import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { FoodLogEntryDraft, MealType } from "@nutrilog/shared";
import { foodLogEntryDraftSchema } from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { mealLabel } from "@/lib/format.js";
import { useAppState } from "@/providers/AppStateProvider.js";
import {
  analyzeFoodImage,
  buildImageMetadata,
  type ScannedFoodDraft,
  type ScanSourceMethod,
} from "@/services/aiScanService.js";

const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

type EditableDraft = {
  key: string;
  draft: FoodLogEntryDraft;
  confidence: number;
  assumptions: string;
};

export function ScanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addEntries } = useAppState();

  const defaultDate = params.get("date") ?? formatLocalDateIso(new Date());
  const [mealDefault, setMealDefault] = useState<MealType>("snack");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EditableDraft[]>([]);
  const [lastMeta, setLastMeta] = useState<{ filename: string; size: number } | null>(null);

  async function runScan(file: File | null, sourceMethod: ScanSourceMethod) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const meta = buildImageMetadata(file, sourceMethod);
      setLastMeta({ filename: meta.filename, size: meta.size });
      const scanned = await analyzeFoodImage({
        file,
        imageMetadata: meta,
        defaultMealType: mealDefault,
      });
      setItems(
        scanned.map((s, idx) => ({
          key: `${meta.uploadedAt}-${idx}`,
          draft: alignDraftToMealDate(s, defaultDate, mealDefault),
          confidence: s.confidence,
          assumptions: s.assumptions,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  function alignDraftToMealDate(s: ScannedFoodDraft, date: string, meal: MealType): FoodLogEntryDraft {
    const now = new Date();
    const draft = {
      ...s.draft,
      date,
      mealType: meal,
      time: s.draft.time || formatLocalTimeIso(now),
    };
    return foodLogEntryDraftSchema.parse(draft);
  }

  function updateItem(key: string, next: Partial<FoodLogEntryDraft>) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const merged = foodLogEntryDraftSchema.parse({ ...row.draft, ...next });
        return { ...row, draft: merged };
      }),
    );
  }

  function saveAll() {
    if (items.length === 0) return;
    addEntries(items.map((i) => i.draft));
    navigate(`/?date=${encodeURIComponent(defaultDate)}`);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">AI assist</p>
          <h1 className="text-2xl font-semibold text-slate-50">Scan food (estimate)</h1>
        </div>
        <Link to="/" className="text-sm font-semibold text-slate-300 hover:text-white">
          Close
        </Link>
      </header>

      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-slate-200">
          Photos are analyzed in-memory for this MVP (mock). Nothing is uploaded or stored permanently — only optional
          metadata can be saved with confirmed entries.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          PHASE 2: wire a serverless endpoint + GPT-5.4 mini vision; keep provider swappable in `aiScanService.ts`.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="mealDefault">
              Default meal
            </label>
            <select
              id="mealDefault"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={mealDefault}
              onChange={(ev) => setMealDefault(ev.target.value as MealType)}
            >
              {meals.map((m) => (
                <option key={m} value={m}>
                  {mealLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="camera">
                Camera
              </label>
              <input
                id="camera"
                name="camera"
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-2 block w-full text-sm text-slate-300"
                disabled={busy}
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  void runScan(f, "camera");
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="upload">
                Upload
              </label>
              <input
                id="upload"
                name="upload"
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-sm text-slate-300"
                disabled={busy}
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  void runScan(f, "upload");
                }}
              />
            </div>
          </div>

          {busy ? <p className="text-sm text-slate-400">Working…</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {lastMeta ? (
            <p className="text-xs text-slate-500">
              Last file: {lastMeta.filename} ({Math.round(lastMeta.size / 1024)} KB) — not persisted.
            </p>
          ) : null}
        </div>
      </Card>

      {items.length > 0 ? (
        <section className="space-y-4" aria-label="Review estimates">
          <h2 className="text-sm font-semibold text-slate-200">Review (estimates)</h2>
          {items.map((row) => (
            <Card key={row.key}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                    {row.confidence < 0.55 ? "Low confidence (uncertain)" : "Estimate"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{row.assumptions}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-name`}>
                    Food name
                  </label>
                  <input
                    id={`${row.key}-name`}
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                    value={row.draft.foodName}
                    onChange={(ev) => updateItem(row.key, { foodName: ev.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-cal`}>
                      Calories
                    </label>
                    <input
                      id={`${row.key}-cal`}
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                      value={String(row.draft.calories)}
                      onChange={(ev) => updateItem(row.key, { calories: Number(ev.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-meal`}>
                      Meal
                    </label>
                    <select
                      id={`${row.key}-meal`}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                      value={row.draft.mealType}
                      onChange={(ev) => updateItem(row.key, { mealType: ev.target.value as MealType })}
                    >
                      {meals.map((m) => (
                        <option key={m} value={m}>
                          {mealLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">P</label>
                    <input
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                      value={String(row.draft.protein)}
                      onChange={(ev) => updateItem(row.key, { protein: Number(ev.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">C</label>
                    <input
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                      value={String(row.draft.carbs)}
                      onChange={(ev) => updateItem(row.key, { carbs: Number(ev.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">F</label>
                    <input
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                      value={String(row.draft.fat)}
                      onChange={(ev) => updateItem(row.key, { fat: Number(ev.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button className="w-full" onClick={saveAll}>
            Save entries
          </Button>
          <p className="text-center text-xs text-slate-500">Nothing is saved until you confirm.</p>
        </section>
      ) : null}
    </div>
  );
}
