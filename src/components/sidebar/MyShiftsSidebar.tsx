"use client";

import { useState } from "react";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { Button, ButtonLink, ExternalButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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
import { buildAnahHandoffEmailUrl } from "@/lib/email";
import { useBrowsableMonths, useMyShifts, useNow } from "@/hooks/useShiftData";
import { useAuth } from "@/components/providers/AuthProvider";
import { HandoffForm } from "@/components/handoff/HandoffForm";
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
  const [showHandoffNotice, setShowHandoffNotice] = useState(false);
  const [editing, setEditing] = useState(false);

  const department = getDepartment(shift.department);
  const handedOff = shift.status === "handedOff";

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handOff() {
    const ok = await run(() => markShiftHandedOff(shift), "הפעולה נכשלה");
    // מיון כללי handoffs need Anah's sign-off before they're final — surface
    // that immediately, since the owner otherwise has no reason to think the
    // shift isn't fully settled once it's marked handed off.
    if (ok && shift.department === "miyun_klali") setShowHandoffNotice(true);
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
          {!handedOff && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="עריכת תורנות"
              className="flex size-6 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-border/50 hover:text-text"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
                aria-hidden="true"
              >
                <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
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
                onClick={handOff}
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

      <MiyunKlaliHandoffNotice
        shift={shift}
        open={showHandoffNotice}
        onClose={() => setShowHandoffNotice(false)}
      />

      <Modal open={editing} title="עריכת תורנות" onClose={() => setEditing(false)}>
        <HandoffForm shift={shift} onSaved={() => setEditing(false)} />
      </Modal>
    </li>
  );
}

/**
 * A מיון כללי handoff isn't final until Anah (מלר"ד) signs off by email — the
 * app has no way to enforce that, so this surfaces the requirement the moment
 * the owner marks the shift handed off, while it's still top of mind.
 */
function MiyunKlaliHandoffNotice({
  shift,
  open,
  onClose,
}: {
  shift: Shift;
  open: boolean;
  onClose: () => void;
}) {
  const emailUrl = buildAnahHandoffEmailUrl({
    date: shift.date,
    ownerName: shift.ownerName,
    ownerEmail: shift.ownerEmail,
  });

  return (
    <Modal open={open} title="איזה כיף, נמצאה החלפה! 🎉" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-text">
        <p>
          שימו לב: ההחלפה אינה סופית עד לקבלת אישור רשמי מאנה מהמלר&quot;ד.
        </p>

        <p className="font-bold text-urgent">
          ⚠️ חובה לכתב (CC) את המחליף/ה!
        </p>

        <div>
          <p className="font-semibold">תוכן המייל חייב לכלול:</p>
          <ul className="list-disc pr-5">
            <li>תאריכי ההחלפה המדויקים</li>
            <li>שמות מלאים</li>
            <li>מספרי תעודת זהות</li>
            <li>כתובות מייל של שני הצדדים</li>
          </ul>
        </div>

        <ExternalButtonLink href={emailUrl} className="self-start">
          שלח מייל
        </ExternalButtonLink>

        <p className="font-bold">
          ללא שליחת המייל וקבלת האישור, המשמרת נשארת על שמכם.
        </p>
      </div>
    </Modal>
  );
}
