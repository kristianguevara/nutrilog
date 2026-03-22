import type { ButtonHTMLAttributes, ReactNode } from "react";

const disabledBase =
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 disabled:shadow-none";

const variants = {
  primary: `bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-500/90 shadow-sm ${disabledBase} disabled:bg-slate-700 disabled:text-slate-500 disabled:hover:bg-slate-700`,
  secondary: `bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 ${disabledBase} disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600 disabled:hover:bg-slate-900`,
  ghost: `bg-transparent text-slate-200 hover:bg-slate-800/80 ${disabledBase} disabled:text-slate-600 disabled:hover:bg-transparent`,
  danger: `bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-500/30 ${disabledBase} disabled:border-rose-500/10 disabled:bg-slate-900 disabled:text-rose-500/40 disabled:hover:bg-slate-900`,
} as const;

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
