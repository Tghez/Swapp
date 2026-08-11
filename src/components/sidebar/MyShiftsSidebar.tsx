"use client";

import { useState } from "react";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  ErrorBanner,
  Spinner,
  SwapBadge,
  UrgentBadge,
} from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { formatLocation, getDepartment } from "@/lib/domain/departments";
import { formatFullDate } from "@/lib/date/calendar";
import { parseDateKey } from "@/lib/date/monthWindow";
import { deleteShift, markShiftHandedOff, reopenShift } from "@/lib/data/shifts";
import { useBrowsableMonths, useMyShifts, useNow } from "@/hooks/useShiftData";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Shift } from "@/lib/domain/types";

/**
 * "התורנויות שלי למסירה" (PDR §6.1) — the landing page's sidebar, and the only
 * place in the app that shows it.
 *
 * This is the owner's side of the exchange: what they have posted, and the
 * actions that close it out once it's settled over WhatsApp — marking a
 * shift handed off by hand ("מסרתי"), or deleting a mistaken post outright
 * ("התחרטתי").
 */
export function MyShiftsSidebar() {
  const { user } = useAuth();
  const now = useNow();
  const months = useBrowsableMonths(now);
  const { data: shifts, loading, error } = useMyShifts(user?.uid, months);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>התורנויות שלי למסירה</CardTitle>
        <ButtonLink href="/handoff" size="sm" aria-label="הוספת תורנות">
          + הוספה
        </ButtonLink>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState>עדיין לא פרסמת תורנויות למסירה</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <MyShiftCard key={shift.id} shift={shift} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MyShiftCard({ shift }: { shift: Shift }) {
  const [confirmingRegret, setConfirmingRegret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const department = getDepartment(shift.department);
  const handedOff = shift.status === "handedOff";

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "rounded-card border border-border border-s-4 p-3",
        department.chipClass,
        handedOff && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "font-bold text-text",
              // Handed-off shifts stay visible but struck through, so the
              // month still reads as "these were mine" (PDR §6.1).
              handedOff && "line-through decoration-2",
            )}
          >
            {formatLocation(shift.department, shift.internalUnit)}
          </p>
          <p className="text-xs text-muted">
            {formatFullDate(parseDateKey(shift.date))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shift.urgent && !handedOff && <UrgentBadge />}
          {shift.willingToSwap && !handedOff && <SwapBadge />}
          {handedOff && (
            <span className="rounded-pill bg-secondary/20 px-2 py-0.5 text-xs font-bold text-secondary-fg">
              ✓ נמסרה
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-urgent">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {handedOff && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => reopenShift(shift), "הפעולה נכשלה")}
          >
            החזרה ללוח
          </Button>
        )}

        {!handedOff &&
          (confirmingRegret ? (
            <>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() =>
                  run(() => deleteShift(shift), "המחיקה נכשלה")
                }
              >
                {busy ? <Spinner className="size-4" /> : "כן, למחוק"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingRegret(false)}
              >
                ביטול
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(() => markShiftHandedOff(shift), "הפעולה נכשלה")
                }
              >
                מסרתי
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingRegret(true)}
              >
                התחרטתי
              </Button>
            </>
          ))}
      </div>
    </li>
  );
}
