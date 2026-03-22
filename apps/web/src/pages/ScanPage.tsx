import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FoodLogEntryDraft, LogItemCategory, MealType } from "@nutrilog/shared";
import { foodLogEntryDraftSchema } from "@nutrilog/shared";
import { formatLocalDateIso, formatLocalTimeIso } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import { Card } from "@/components/ui/Card.js";
import { captureFrameFile, openCameraStream, stopMediaStream } from "@/lib/cameraCapture.js";
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

type PendingPreview = {
  file: File;
  sourceMethod: ScanSourceMethod;
  objectUrl: string;
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
  const [scanDescription, setScanDescription] = useState("");
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [scanProgressPercent, setScanProgressPercent] = useState(0);
  const [scanElapsedSec, setScanElapsedSec] = useState(0);
  const [scanLogLines, setScanLogLines] = useState<string[]>([]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!cameraOpen || !cameraStream || !v) return;
    v.srcObject = cameraStream;
    void v.play().catch(() => {
      /* ignore */
    });
    return () => {
      v.srcObject = null;
    };
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    return () => {
      stopMediaStream(cameraStream);
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (pendingPreview?.objectUrl) {
        URL.revokeObjectURL(pendingPreview.objectUrl);
      }
    };
  }, [pendingPreview?.objectUrl]);

  useEffect(() => {
    if (!busy) return;
    setScanProgressPercent(0);
    setScanElapsedSec(0);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setScanElapsedSec(Math.floor(elapsed));
      // No hard cap at 95: approaches ~99% slowly so long OpenAI waits don’t look “stuck” at one number.
      setScanProgressPercent(Math.min(99, Math.floor(100 * (1 - Math.exp(-elapsed / 55)))));
    }, 250);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (busy) return;
    const id = window.setTimeout(() => {
      setScanProgressPercent(0);
      setScanElapsedSec(0);
    }, 900);
    return () => window.clearTimeout(id);
  }, [busy]);

  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  function clearPendingPreview() {
    if (busy) return;
    setPendingPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    setScanDescription("");
  }

  function setPendingFromFile(file: File, sourceMethod: ScanSourceMethod) {
    setPendingPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return {
        file,
        sourceMethod,
        objectUrl: URL.createObjectURL(file),
      };
    });
    setError(null);
  }

  function handleCloseClick() {
    if (busy) {
      const leave = window.confirm(
        "You're currently submitting data to the scan service. Leaving now could lose this in-progress request and any unsaved review. Are you sure you want to continue?",
      );
      if (!leave) return;
    }
    navigate("/");
  }

  async function openCameraUi() {
    if (busy) return;
    setError(null);
    try {
      const stream = await openCameraStream();
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open camera.");
    }
  }

  function closeCameraUi() {
    stopMediaStream(cameraStream);
    setCameraStream(null);
    setCameraOpen(false);
  }

  async function captureFromCamera() {
    const v = videoRef.current;
    if (!v || busy) return;
    setError(null);
    try {
      const file = await captureFrameFile(v);
      closeCameraUi();
      setPendingFromFile(file, "camera");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed.");
    }
  }

  function pushScanLog(message: string) {
    const stamp = new Date().toLocaleTimeString(undefined, { hour12: false });
    const line = `${stamp}  ${message}`;
    setScanLogLines((prev) => [...prev, line].slice(-50));
  }

  async function runScan(file: File | null, sourceMethod: ScanSourceMethod) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setScanLogLines([
      `${new Date().toLocaleTimeString(undefined, { hour12: false })}  Starting scan…`,
    ]);
    let completedOk = false;
    try {
      const meta = buildImageMetadata(file, sourceMethod);
      setLastMeta({ filename: meta.filename, size: meta.size });
      if (import.meta.env.DEV) {
        console.info("[scan] starting analyzeFoodImage", { filename: meta.filename, size: meta.size });
      }
      const scanned = await analyzeFoodImage({
        file,
        imageMetadata: meta,
        defaultMealType: mealDefault,
        description: scanDescription.trim() || undefined,
        onStep: (msg) => {
          pushScanLog(msg);
          if (import.meta.env.DEV) console.info("[scan step]", msg);
        },
      });
      completedOk = true;
      setPendingPreview((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return null;
      });
      setScanDescription("");
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
      if (completedOk) setScanProgressPercent(100);
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
    if (items.length === 0 || busy) return;
    addEntries(items.map((i) => i.draft));
    navigate(`/?date=${encodeURIComponent(defaultDate)}`);
  }

  const canSubmitScan = Boolean(pendingPreview) && !busy;

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">AI assist</p>
          <h1 className="text-2xl font-semibold text-slate-50">Scan meal (estimate)</h1>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-slate-300 hover:text-white"
          onClick={handleCloseClick}
        >
          Close
        </button>
      </header>

      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-slate-200">
          Photograph <strong className="text-slate-100">food or drinks</strong> (plates, cups, bottles, cans). Use the camera or upload, add an optional description, then tap{" "}
          <strong className="text-slate-100">Submit scan</strong>. With the real API, the image is sent to your serverless vision model (OpenAI or Gemini per server config) — image bytes are not stored.
        </p>

        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Camera</p>
              <p className="mt-1 text-xs text-slate-500">
                Works for meals or beverages — after capture, add details and submit (same flow as upload).
              </p>
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={busy}
                onClick={() => void openCameraUi()}
              >
                Use camera
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Upload file</p>
              <p className="mt-1 text-xs text-slate-500">
                Pick a photo of food or a drink; you&apos;ll confirm description and submit before scanning.
              </p>
              <input
                ref={uploadInputRef}
                id="upload"
                name="upload"
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                disabled={busy}
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  const input = ev.target;
                  if (f) setPendingFromFile(f, "upload");
                  input.value = "";
                }}
              />
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={busy}
                onClick={() => uploadInputRef.current?.click()}
              >
                Choose photo
              </Button>
            </div>
          </div>

          {pendingPreview ? (
            <div className="rounded-xl border border-emerald-500/25 bg-slate-950/80 p-4">
              <p className="text-sm font-semibold text-emerald-200/95">Review before scan</p>
              <p className="mt-1 text-xs text-slate-500">
                Add context below, then submit. Nothing is sent to the model until you tap Submit scan.
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-black/40">
                <img
                  src={pendingPreview.objectUrl}
                  alt="Selected meal preview"
                  className="mx-auto max-h-64 w-full object-contain"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-200" htmlFor="scan-description">
                  Description (optional)
                </label>
                <textarea
                  id="scan-description"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                  placeholder="e.g. large latte oat milk, meal prep bowl, 12oz can — helps the model interpret the photo"
                  value={scanDescription}
                  onChange={(ev) => setScanDescription(ev.target.value)}
                  disabled={busy}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Included in the AI prompt. Saved as notes on each line item if you confirm entries.
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-200" htmlFor="mealDefault">
                  Default meal
                  <RequiredMark />
                </label>
                <select
                  id="mealDefault"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                  value={mealDefault}
                  onChange={(ev) => setMealDefault(ev.target.value as MealType)}
                  disabled={busy}
                >
                  {meals.map((m) => (
                    <option key={m} value={m}>
                      {mealLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  disabled={!canSubmitScan}
                  onClick={() => void runScan(pendingPreview.file, pendingPreview.sourceMethod)}
                >
                  {busy ? "Scanning…" : "Submit scan"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:flex-1"
                  disabled={busy}
                  onClick={clearPendingPreview}
                >
                  Choose different photo
                </Button>
              </div>

              {busy ? (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                    <span className="font-semibold tabular-nums text-emerald-300">{scanProgressPercent}%</span>
                    <span className="tabular-nums text-slate-400">Elapsed {scanElapsedSec}s</span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">
                    The bar is a <span className="text-slate-400">rough visual only</span> (the browser cannot see
                    OpenAI progress). While the request is in flight, watch the activity log and your{" "}
                    <code className="rounded bg-black/40 px-1 text-slate-400">pnpm dev:api</code> terminal for numbered
                    steps <span className="text-slate-400">4/7–5/7</span> can take minutes.
                  </p>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-valuenow={scanProgressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Approximate scan progress"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min(100, scanProgressPercent)}%` }}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Activity</p>
                    <pre
                      className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-800/80 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-300"
                      aria-live="polite"
                    >
                      {scanLogLines.join("\n")}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-3">
              <p className="text-sm leading-relaxed text-rose-100">{error}</p>
              <p className="mt-2 text-xs text-rose-200/70">
                Check the terminal running <code className="rounded bg-black/30 px-1">pnpm dev:api</code> for timed logs
                (OpenAI can take a minute for large images). Browser console (F12) for client hints.
              </p>
              {pendingPreview ? (
                <Button
                  type="button"
                  className="mt-3 w-full"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void runScan(pendingPreview.file, pendingPreview.sourceMethod)}
                >
                  Retry scan
                </Button>
              ) : null}
            </div>
          ) : null}
          {lastMeta ? (
            <p className="text-xs text-slate-500">
              Last scanned file: {lastMeta.filename} ({Math.round(lastMeta.size / 1024)} KB) — image not persisted.
            </p>
          ) : null}
        </div>
      </Card>

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Camera capture"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-card">
            <p className="text-sm font-semibold text-slate-100">Camera preview</p>
            <p className="mt-1 text-xs text-slate-400">{`Allow camera access when prompted. On desktop, this uses your default webcam. After capture you can add a description and submit.`}</p>
            <video
              ref={videoRef}
              className="mt-4 aspect-video w-full rounded-xl bg-black object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="mt-4 flex gap-3">
              <Button type="button" className="flex-1" onClick={() => void captureFromCamera()} disabled={busy}>
                Capture
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={closeCameraUi} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
                    {row.draft.itemCategory === "drink" ? "Drink name" : "Food name"}
                    <RequiredMark />
                  </label>
                  <input
                    id={`${row.key}-name`}
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                    value={row.draft.foodName}
                    disabled={busy}
                    onChange={(ev) => updateItem(row.key, { foodName: ev.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-type`}>
                      Type
                      <RequiredMark />
                    </label>
                    <select
                      id={`${row.key}-type`}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                      value={row.draft.itemCategory}
                      disabled={busy}
                      onChange={(ev) =>
                        updateItem(row.key, { itemCategory: ev.target.value as LogItemCategory })
                      }
                    >
                      <option value="food">Food</option>
                      <option value="drink">Drink</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-meal`}>
                      Meal
                      <RequiredMark />
                    </label>
                    <select
                      id={`${row.key}-meal`}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                      value={row.draft.mealType}
                      disabled={busy}
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

                <div>
                  <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-cal`}>
                    Calories
                    <RequiredMark />
                  </label>
                  <input
                    id={`${row.key}-cal`}
                    inputMode="numeric"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                    value={String(row.draft.calories)}
                    disabled={busy}
                    onChange={(ev) => updateItem(row.key, { calories: Number(ev.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-p`}>
                      P
                      <RequiredMark />
                    </label>
                    <input
                      id={`${row.key}-p`}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                      value={String(row.draft.protein)}
                      disabled={busy}
                      onChange={(ev) => updateItem(row.key, { protein: Number(ev.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-c`}>
                      C
                      <RequiredMark />
                    </label>
                    <input
                      id={`${row.key}-c`}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                      value={String(row.draft.carbs)}
                      disabled={busy}
                      onChange={(ev) => updateItem(row.key, { carbs: Number(ev.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300" htmlFor={`${row.key}-f`}>
                      F
                      <RequiredMark />
                    </label>
                    <input
                      id={`${row.key}-f`}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45"
                      value={String(row.draft.fat)}
                      disabled={busy}
                      onChange={(ev) => updateItem(row.key, { fat: Number(ev.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button className="w-full" disabled={busy} onClick={saveAll}>
            Save entries
          </Button>
          <p className="text-center text-xs text-slate-500">Nothing is saved until you confirm.</p>
        </section>
      ) : null}
    </div>
  );
}
