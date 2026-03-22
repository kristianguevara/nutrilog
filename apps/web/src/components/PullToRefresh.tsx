import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const THRESHOLD_PX = 56;
const MAX_PULL_PX = 96;
const RESISTANCE = 0.45;

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('input, textarea, select, button, a, [data-no-ptr], [role="dialog"]'),
  );
}

/**
 * Mobile-style pull-down from the top when the window is scrolled to the top → hard reload.
 * Helps PWA users pick up new builds and bust caches without hunting for browser chrome.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const [pullPx, setPullPx] = useState(0);
  const startY = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 2) return;
      if (shouldIgnoreTarget(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
      active.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current) return;
      if (window.scrollY > 2) {
        active.current = false;
        pullRef.current = 0;
        setPullPx(0);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy > 0) {
        e.preventDefault();
        const p = Math.min(dy * RESISTANCE, MAX_PULL_PX);
        pullRef.current = p;
        setPullPx(p);
      }
    };

    const onTouchEnd = () => {
      if (!active.current) return;
      active.current = false;
      const p = pullRef.current;
      pullRef.current = 0;
      setPullPx(0);
      if (p >= THRESHOLD_PX) {
        window.location.reload();
      }
    };

    const onTouchCancel = () => {
      active.current = false;
      pullRef.current = 0;
      setPullPx(0);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  const show = pullPx > 4;
  const ready = pullPx >= THRESHOLD_PX;

  return (
    <>
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[200] flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]"
        aria-hidden={!show}
      >
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg transition-colors ${
            ready ?
              "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
            : "border-slate-700/80 bg-slate-900/95 text-slate-400"
          }`}
          style={{
            opacity: show ? Math.min(1, pullPx / 28) : 0,
            transform: `translateY(${Math.min(pullPx * 0.35, 28)}px)`,
          }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
            style={{ transform: `rotate(${pullPx * 3}deg)` }}
          />
          {ready ? "Release to refresh" : "Pull to refresh"}
        </div>
      </div>
      {children}
    </>
  );
}
