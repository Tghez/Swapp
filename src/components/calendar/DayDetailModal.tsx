"use client";

import { Modal } from "@/components/ui/Modal";
import { Button, ExternalButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { SwapBadge, UrgentBadge } from "@/components/ui/Feedback";
import { formatFullDate } from "@/lib/date/calendar";
import {
  DEPARTMENTS,
  formatLocation,
  getDepartment,
  type Department,
  type DepartmentId,
} from "@/lib/domain/departments";
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
  onClose: () => void;
}

/** Full detail for one day (PDR §6.3). Selecting a shift opens WhatsApp with the intern who posted it. */
export function DayDetailModal({
  date,
  shifts,
  currentUid,
  onClose,
}: DayDetailModalProps) {
  const dateLabel = date ? formatFullDate(date) : "";

  function renderShift(shift: Shift) {
    return (
      <ShiftDetail
        key={shift.id}
        shift={shift}
        isOwn={shift.ownerId === currentUid}
        dateLabel={dateLabel}
      />
    );
  }

  // Grouping only earns its keep once there is something to disambiguate —
  // a single shift just renders flat, same as before.
  const groups = shifts.length > 1 ? groupByDepartment(shifts) : null;

  return (
    <Modal open={date !== null} title={dateLabel} onClose={onClose}>
      {shifts.length === 0 ? (
        <EmptyState>אין תורנויות ביום הזה</EmptyState>
      ) : groups ? (
        <div className="flex flex-col gap-3">
          {groups.map(({ department, shifts: groupShifts }) => (
            <details
              key={department.id}
              open
              className="group overflow-hidden rounded-card border border-border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 font-bold text-text">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", department.dotClass)}
                  />
                  {department.label}
                  <span className="text-xs font-normal text-muted">
                    ({groupShifts.length})
                  </span>
                </span>
                <ChevronIcon className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul className="flex flex-col gap-3 border-t border-border p-3">
                {groupShifts.map(renderShift)}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{shifts.map(renderShift)}</ul>
      )}
    </Modal>
  );
}

interface DepartmentGroup {
  department: Department;
  shifts: Shift[];
}

/** Fixed department order (same as the legend), not the order shifts arrive in. */
function groupByDepartment(shifts: readonly Shift[]): DepartmentGroup[] {
  const byId = new Map<DepartmentId, Shift[]>();
  for (const shift of shifts) {
    const list = byId.get(shift.department);
    if (list) list.push(shift);
    else byId.set(shift.department, [shift]);
  }
  return DEPARTMENTS.filter((department) => byId.has(department.id)).map(
    (department) => ({ department, shifts: byId.get(department.id)! }),
  );
}

interface ShiftDetailProps {
  shift: Shift;
  isOwn: boolean;
  dateLabel: string;
}

function ShiftDetail({ shift, isOwn, dateLabel }: ShiftDetailProps) {
  const department = getDepartment(shift.department);
  const location = formatLocation(shift.department, shift.internalUnit);
  const handedOff = shift.status === "handedOff";

  const whatsAppUrl = buildWhatsAppUrl(
    shift.ownerPhone,
    buildWhatsAppMessage({
      ownerName: shift.ownerName,
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
        {shift.willingToSwap && !handedOff && <SwapBadge />}
        {handedOff && (
          <span className="rounded-pill bg-secondary/20 px-2 py-0.5 text-xs font-bold text-secondary-fg">
            ✓ נמסרה
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
            <ExternalButtonLink href={whatsAppUrl} className="w-full">
              <WhatsAppMark />
              אני רוצה את התורנות
            </ExternalButtonLink>
            <p className="mt-2 text-center text-xs text-muted">
              ייפתח וואטסאפ עם מי שפרסם את התורנות
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}
