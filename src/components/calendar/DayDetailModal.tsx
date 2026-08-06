"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button, ExternalButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { ErrorBanner, UrgentBadge } from "@/components/ui/Feedback";
import { formatFullDate } from "@/lib/date/calendar";
import { formatLocation, getDepartment } from "@/lib/domain/departments";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatPhoneForDisplay,
} from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import type { Shift } from "@/lib/domain/types";

interface DayDetailModalProps {
  date: Date | null;
  shifts: readonly Shift[];
  currentUid: string;
  takerName: string;
  interestedShiftIds: ReadonlySet<string>;
  onRegisterInterest: (shift: Shift) => Promise<void>;
  onClose: () => void;
}

/**
 * Full detail for one day (PDR §6.3). Selecting a shift both registers
 * interest and opens WhatsApp with the intern who posted it.
 */
export function DayDetailModal({
  date,
  shifts,
  currentUid,
  takerName,
  interestedShiftIds,
  onRegisterInterest,
  onClose,
}: DayDetailModalProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={date !== null}
      title={date ? formatFullDate(date) : ""}
      onClose={onClose}
    >
      {error && (
        <div className="mb-4">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      {shifts.length === 0 ? (
        <EmptyState>אין תורנויות ביום הזה</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <ShiftDetail
              key={shift.id}
              shift={shift}
              isOwn={shift.ownerId === currentUid}
              takerName={takerName}
              alreadyInterested={interestedShiftIds.has(shift.id)}
              dateLabel={date ? formatFullDate(date) : ""}
              onRegisterInterest={async () => {
                setError(null);
                try {
                  await onRegisterInterest(shift);
                } catch (caught) {
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : "לא הצלחנו לסמן עניין. יש לנסות שוב.",
                  );
                }
              }}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
}

interface ShiftDetailProps {
  shift: Shift;
  isOwn: boolean;
  takerName: string;
  alreadyInterested: boolean;
  dateLabel: string;
  onRegisterInterest: () => void;
}

function ShiftDetail({
  shift,
  isOwn,
  takerName,
  alreadyInterested,
  dateLabel,
  onRegisterInterest,
}: ShiftDetailProps) {
  const department = getDepartment(shift.department);
  const location = formatLocation(shift.department, shift.internalUnit);
  const handedOff = shift.status === "handedOff";

  const whatsAppUrl = buildWhatsAppUrl(
    shift.ownerPhone,
    buildWhatsAppMessage({
      ownerName: shift.ownerName,
      takerName,
      location,
      dateLabel,
    }),
  );

  return (
    <li
      className={cn(
        "rounded-card border-s-4 border border-border p-4",
        department.chipClass,
        handedOff && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-text">{location}</h3>
        {shift.urgent && !handedOff && <UrgentBadge />}
        {handedOff && (
          <span className="rounded-pill bg-text/10 px-2 py-0.5 text-xs font-bold text-muted">
            נמסרה
          </span>
        )}
      </div>

      <dl className="mt-2 flex flex-col gap-1 text-sm text-text/80">
        <div className="flex gap-2">
          <dt className="font-semibold">מוסר/ת:</dt>
          <dd>{shift.ownerName}</dd>
        </div>
        {shift.ownerPhone && (
          <div className="flex gap-2">
            <dt className="font-semibold">טלפון:</dt>
            <dd dir="ltr">{formatPhoneForDisplay(shift.ownerPhone)}</dd>
          </div>
        )}
        {shift.note && (
          <div className="flex gap-2">
            <dt className="font-semibold">הערה:</dt>
            <dd>{shift.note}</dd>
          </div>
        )}
        {shift.interestCount > 0 && (
          <div className="flex gap-2">
            <dt className="font-semibold">מתעניינים:</dt>
            <dd>{shift.interestCount}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3">
        {isOwn ? (
          <p className="text-xs font-medium text-muted">
            זו תורנות שפרסמת. ניתן לנהל אותה מהדף הראשי.
          </p>
        ) : handedOff ? (
          <p className="text-xs font-medium text-muted">
            התורנות כבר נמסרה למישהו אחר.
          </p>
        ) : whatsAppUrl ? (
          <>
            {/*
              A real anchor, not window.open after an await: Safari blocks a
              popup opened once the click's user gesture has been consumed by
              an async call. The interest write is fired alongside the
              navigation rather than before it.
            */}
            <ExternalButtonLink
              href={whatsAppUrl}
              // Registering is once-and-done. Firing it again on a follow-up
              // visit would hit the "already interested" guard and show an
              // error for what is really just reopening the conversation.
              onClick={alreadyInterested ? undefined : onRegisterInterest}
              className="w-full"
            >
              <WhatsAppMark />
              {alreadyInterested ? "המשך שיחה בוואטסאפ" : "אני רוצה את התורנות"}
            </ExternalButtonLink>
            <p className="mt-2 text-center text-xs text-muted">
              {alreadyInterested
                ? "כבר סימנת עניין בתורנות הזו"
                : "ייפתח וואטסאפ, והמוסר/ת יראה שסימנת עניין"}
            </p>
          </>
        ) : (
          <Button variant="secondary" disabled className="w-full">
            מספר הטלפון של המוסר/ת אינו תקין
          </Button>
        )}
      </div>
    </li>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}
