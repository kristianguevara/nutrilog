import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button.js";
import { Card } from "@/components/ui/Card.js";
import { PasswordField } from "@/components/ui/PasswordField.js";
import { RequiredMark } from "@/components/ui/RequiredMark.js";
import { useAppState } from "@/providers/AppStateProvider.js";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const infoMessage = (location.state as { message?: string } | null)?.message ?? null;
  const { signIn } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-10 pt-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">NutriLog</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Sign in</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Use the email and password you chose during onboarding. Your log syncs to your account.
        </p>
      </header>

      <Card>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="login-email">
              Email
              <RequiredMark />
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="login-password">
              Password
              <RequiredMark />
            </label>
            <PasswordField
              id="login-password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </div>

          {infoMessage ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100/90">
              {infoMessage}
            </p>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            No account?{" "}
            <Link className="font-medium text-emerald-400 hover:text-emerald-300" to="/onboarding">
              Create one
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
