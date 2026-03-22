import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GoalType } from "@nutrilog/shared";
import { userProfileDraftSchema } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { useAppState } from "@/providers/AppStateProvider.js";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { saveProfile } = useAppState();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("maintain_weight");
  const [targetRaw, setTargetRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const goalOptions = useMemo(
    () =>
      [
        { value: "lose_weight" as const, label: "Lose weight" },
        { value: "maintain_weight" as const, label: "Maintain weight" },
        { value: "gain_weight" as const, label: "Gain weight" },
      ] as const,
    [],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const targetNum = targetRaw.trim() === "" ? undefined : Number(targetRaw);
    const parsed = userProfileDraftSchema.safeParse({
      nickname: nickname.trim(),
      email: email.trim(),
      goalType,
      dailyCalorieTarget:
        targetNum === undefined || Number.isNaN(targetNum) ? undefined : targetNum,
    });
    if (!parsed.success) {
      setError("Please check your inputs — nickname and email are required.");
      return;
    }
    saveProfile(parsed.data);
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-10 pt-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">NutriLog</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Welcome</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Quick setup for a personal, local-first log. This is not medical advice — just practical
          estimates to help you notice patterns.
        </p>
      </header>

      <Card>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="nickname">
              Nickname
            </label>
            <input
              id="nickname"
              name="nickname"
              autoComplete="nickname"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
            <p className="mt-2 text-xs text-slate-500">Stored only on this device for now.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-200">Goal</legend>
            <div className="mt-3 space-y-2">
              {goalOptions.map((g) => (
                <label
                  key={g.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-200 hover:bg-slate-900/60"
                >
                  <input
                    type="radio"
                    name="goalType"
                    value={g.value}
                    checked={goalType === g.value}
                    onChange={() => setGoalType(g.value)}
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="target">
              Daily calorie target (optional)
            </label>
            <input
              id="target"
              name="target"
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={targetRaw}
              onChange={(ev) => setTargetRaw(ev.target.value)}
              placeholder="e.g. 2200"
            />
            <p className="mt-2 text-xs text-slate-500">
              This is a planning number — adjust anytime in Settings.
            </p>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
