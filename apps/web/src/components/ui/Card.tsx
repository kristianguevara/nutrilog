import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-card backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
