import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="טוען"
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-border border-t-primary",
        className,
      )}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

/** Inline error banner. `role="alert"` so failures are announced, not just shown. */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-card border border-urgent bg-urgent-soft px-4 py-3 text-sm font-medium text-text"
    >
      {children}
    </p>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-card border-2 border-secondary bg-secondary/10 px-4 py-3 text-sm font-medium text-secondary-fg"
    >
      {children}
    </p>
  );
}

/** The דחיפות marker. Coral, never amber, so it cannot read as a button. */
export function UrgentBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-urgent px-2 py-0.5 text-xs font-bold text-white",
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="size-3"
      >
        <path d="M10 1.5a1 1 0 01.9.56l7.5 15A1 1 0 0117.5 18.5h-15a1 1 0 01-.9-1.44l7.5-15A1 1 0 0110 1.5zm0 5a.9.9 0 00-.9 1l.3 4a.6.6 0 001.2 0l.3-4a.9.9 0 00-.9-1zm0 8.4a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
      דחוף
    </span>
  );
}
