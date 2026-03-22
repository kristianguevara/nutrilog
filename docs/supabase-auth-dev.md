# Supabase Auth — local development

All of this is configured in the **Supabase Dashboard** for your project. Nothing in the NutriLog repo can turn off email confirmation or rate limits for you.

---

## Free tier: only ~2 auth emails (then “use custom SMTP”)

On the **hosted free plan**, Supabase only allows a handful of **auth-related emails per hour** unless you add **custom SMTP**. That is a **project quota**, not something NutriLog can bypass in code.

**Easiest way to finish registration without touching SMTP:** stop sending those emails.

1. **Authentication → Providers → Email** → turn **Confirm email** **OFF** (see section 1 below).
2. Sign up again in the app. With confirmations off, Supabase **does not send a signup email**, so you stay under the cap and you get a **session immediately** — you can complete onboarding in NutriLog.

If you **already** burned the quota with “Confirm email” **ON**, either **wait** for the window to reset (often an hour) or **create the user by hand** (section 4).

---

## 1. Turn off “Confirm email” (recommended for local dev)

When this is **off**, new sign-ups get a **session immediately** and no confirmation email is sent. That avoids inbox limits and makes sign-up faster while you build.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Authentication** (left sidebar).
3. Open **Providers** (or **Sign In / Providers**), then **Email**.
4. Find **Confirm email** (sometimes labeled “Enable email confirmations” or similar).
5. **Disable** it for local development.
6. Save if the UI asks you to.

**Production:** turn **Confirm email** back **on** if you want only verified addresses.

Docs: [Email login](https://supabase.com/docs/guides/auth/auth-email-password) (provider options vary slightly by dashboard version).

---

## 2. Reduce the “wait time” / rate limits

Supabase enforces **rate limits** on auth actions (sign-up, sign-in, OTP, emails sent, etc.). The “try again after 12 seconds” / `over_email_send_rate_limit` messages come from here—not from your app.

You **cannot** fully “disable” limits on hosted Supabase in a way that removes all throttling; you **raise** the caps so they don’t bother you during development.

1. In the dashboard, go to **Authentication**.
2. Open **Rate Limits** (or **Attack Protection** / **Rate limiting** depending on your UI version—see sidebar under Authentication).
3. Increase the values that are blocking you, for example:
   - **Signups** / **sign-up** limits per hour  
   - **Emails sent** / **OTP** / **magic link** limits if you still use email flows  
   - Any **per-IP** or **per-email** throttle that matches your error
4. Save.

Direct link pattern (replace `YOUR_PROJECT_REF` with the ref in **Project Settings → General**):

`https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/rate-limits`

Official reference: [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

**If you turned off Confirm email** (section 1), you send far fewer auth emails, so `over_email_send_rate_limit` usually stops being an issue.

---

## 3. Other tips

- **Different test emails:** `you+test1@gmail.com`, `you+test2@gmail.com` to avoid hitting the same recipient limits.
- **Wait:** limits often use a rolling window; if you’re still blocked, wait and retry later.
- **Profile + RLS:** if sign-up failed with `profiles` RLS errors, run `docs/supabase-profile-trigger.sql` in the SQL Editor.

---

## 4. Stuck mid–sign-up? Create the user in the dashboard

If you can’t sign up in the app because email quota is exhausted but you need **one** account **now**:

1. **Authentication → Users** → **Add user** → **Create new user**.
2. Enter the **same email** you want to use in NutriLog and a **password**.
3. Enable **Auto Confirm User** (or equivalent) so you do **not** depend on a confirmation email.
4. Save, then in NutriLog use **Sign in** (not Create account) with that email and password.
5. If you have no profile row yet, the app should send you through **onboarding** to finish nickname / goals.

This path uses **no** outbound confirmation email for that user if you auto-confirm.
