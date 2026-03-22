import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GoalType } from "@nutrilog/shared";
import { userProfileDraftSchema } from "@nutrilog/shared";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { PasswordField } from "@/components/ui/PasswordField.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import { useAppState } from "@/providers/AppStateProvider.js";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { saveProfile, signUp, isSupabase, session } = useAppState();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("maintain_weight");
  const [targetRaw, setTargetRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountEmail = session?.user?.email ?? "";

  const goalOptions = useMemo(
    () =>
      [
        { value: "lose_weight" as const, label: "Lose weight" },
        { value: "maintain_weight" as const, label: "Maintain weight" },
        { value: "gain_weight" as const, label: "Gain weight" },
      ] as const,
    [],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const targetNum = targetRaw.trim() === "" ? undefined : Number(targetRaw);
    const parsed = userProfileDraftSchema.safeParse({
      nickname: nickname.trim(),
      email: isSupabase && session ? accountEmail.trim() : email.trim(),
      goalType,
      dailyCalorieTarget:
        targetNum === undefined || Number.isNaN(targetNum) ? undefined : targetNum,
    });
    if (!parsed.success) {
      setError("Please check your inputs — nickname and email are required.");
      return;
    }

    if (isSupabase && session) {
      setBusy(true);
      await saveProfile(parsed.data);
      setBusy(false);
      navigate("/", { replace: true });
      return;
    }

    if (isSupabase && !session) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setBusy(true);
      const result = await signUp(parsed.data.email, password, parsed.data);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.hasSession) {
        navigate("/", { replace: true });
        return;
      }
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Account created. Confirm your email if your project requires it, then sign in — your profile was saved.",
        },
      });
      return;
    }

    await saveProfile(parsed.data);
    navigate("/", { replace: true });
  }

  const supabaseSignup = isSupabase && !session;
  const supabaseComplete = isSupabase && !!session;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-10 pt-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">NutriLog</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">
          {supabaseComplete ? "Finish your profile" : "Welcome"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {isSupabase
            ? "Your email is your account — we store your log in Supabase (PostgreSQL) with row-level security."
            : "Quick setup for a personal, local-first log. This is not medical advice — just practical estimates to help you notice patterns."}
        </p>
      </header>

      <Card>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="nickname">
              Nickname
              <RequiredMark />
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
              Email (your username)
              <RequiredMark />
            </label>
            {supabaseComplete ? (
              <input
                id="email"
                name="email"
                type="email"
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm text-slate-400 outline-none"
                value={accountEmail}
              />
            ) : (
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                disabled={supabaseComplete}
              />
            )}
            <p className="mt-2 text-xs text-slate-500">
              {isSupabase
                ? "Used for sign-in and to match imports from backup files."
                : "Stored only on this device for now."}
            </p>
          </div>

          {supabaseSignup ? (
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="password">
                Password
                <RequiredMark />
              </label>
              <PasswordField
                id="password"
                name="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <p className="mt-2 text-xs text-slate-500">At least 6 characters (Supabase default).</p>
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-medium text-slate-200">
              Goal
              <RequiredMark />
            </legend>
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

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : supabaseSignup ? "Create account" : "Continue"}
          </Button>

          {supabaseSignup ? (
            <p className="text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link className="font-medium text-emerald-400 hover:text-emerald-300" to="/login">
                Sign in
              </Link>
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
