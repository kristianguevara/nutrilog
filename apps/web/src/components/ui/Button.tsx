import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-500/90 shadow-sm",
  secondary:
    "bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-800 border border-slate-700",
  ghost: "bg-transparent text-slate-200 hover:bg-slate-800/80",
  danger: "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-500/30",
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
