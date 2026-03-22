import { Button } from "@/components/ui/Button.js";

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{message}</p>
        {onDismiss ? (
          <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
