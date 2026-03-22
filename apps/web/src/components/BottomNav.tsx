import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 flex-1 flex-col items-center justify-center gap-1 px-2 text-xs ${
    isActive ? "text-emerald-300" : "text-slate-400 hover:text-slate-200"
  }`;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end className={linkClass}>
          <span aria-hidden>◎</span>
          <span>Today</span>
        </NavLink>
        <NavLink to="/reports" className={linkClass}>
          <span aria-hidden>▤</span>
          <span>Reports</span>
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          <span aria-hidden>⚙</span>
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}
