"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { ChevronIcon, ShiftDetail } from "@/components/calendar/DayDetailModal";
import { EmptyState } from "@/components/ui/Card";
import { ErrorBanner, Spinner } from "@/components/ui/Feedback";
import { useNow, useUpcomingUrgentShifts } from "@/hooks/useShiftData";
import { formatFullDate } from "@/lib/date/calendar";
import { parseDateKey } from "@/lib/date/monthWindow";

const WINDOW_DAYS = 3;

/**
 * Folded by default (PDR gives it no section of its own) — opened by tapping
 * the header, same `<details>`/`<summary>` idiom as the day-detail modal's
 * department groups, so it reads as the same app rather than a new pattern.
 */
export function UpcomingUrgentShifts() {
  const { user } = useAuth();
  const now = useNow();
  const { data: shifts, loading, error } = useUpcomingUrgentShifts(
    now,
    WINDOW_DAYS,
  );

  if (error) {
    return (
      <div className="mt-6 w-full max-w-md">
        <ErrorBanner>{error}</ErrorBanner>
      </div>
    );
  }

  function renderShift(shift: (typeof shifts)[number]) {
    return (
      <ShiftDetail
        key={shift.id}
        shift={shift}
        isOwn={shift.ownerId === (user?.uid ?? "")}
        dateLabel={formatFullDate(parseDateKey(shift.date))}
        showDate
      />
    );
  }

  return (
    <details className="group mt-6 w-full max-w-md overflow-hidden rounded-card border border-border bg-surface text-start">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-bold text-text">
          <span className="size-2.5 shrink-0 rounded-full bg-urgent" />
          תורנויות דחופות ב-3 הימים הקרובים
          {!loading && (
            <span className="text-xs font-normal text-muted">
              ({shifts.length})
            </span>
          )}
        </span>
        <ChevronIcon className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : shifts.length === 0 ? (
          <EmptyState>אין תורנויות דחופות בטווח הזה</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">{shifts.map(renderShift)}</ul>
        )}
      </div>
    </details>
  );
}
