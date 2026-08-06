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

/** Marks a shift whose owner is open to a swap, not only a straight handoff. */
export function SwapBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-secondary/15 px-2 py-0.5 text-xs font-bold text-secondary-fg",
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="size-3"
      >
        <path d="M6.5 3a.75.75 0 01.75.75v1.5H15a2 2 0 012 2V9a.75.75 0 01-1.5 0V7.25a.5.5 0 00-.5-.5H7.25v1.5a.75.75 0 01-1.28.53l-2.5-2.5a.75.75 0 010-1.06l2.5-2.5A.75.75 0 016.5 3zm7 8.75a.75.75 0 011.28-.53l2.5 2.5a.75.75 0 010 1.06l-2.5 2.5a.75.75 0 01-1.28-.53v-1.5H5a2 2 0 01-2-2V11a.75.75 0 011.5 0v1.75a.5.5 0 00.5.5h7.25v-1.5z" />
      </svg>
      גם להחלפה
    </span>
  );
}
