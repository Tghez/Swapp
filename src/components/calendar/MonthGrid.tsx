"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { buildMonthGrid, groupByDateKey, WEEKDAY_LABELS } from "@/lib/date/calendar";
import { formatFullDate } from "@/lib/date/calendar";
import { ShiftChip } from "./ShiftChip";
import type { Shift } from "@/lib/domain/types";

/** How many chips fit in a cell before collapsing to a "+N" summary. */
const MAX_CHIPS_PER_CELL = 2;

interface MonthGridProps {
  monthDate: Date;
  shifts: readonly Shift[];
  onSelectDay: (date: Date) => void;
}

/**
 * Google-Calendar-style month view (PDR §6.3).
 *
 * Direction is inherited from the document's dir="rtl", so the grid fills from
 * the right without any per-cell ordering logic — Sunday lands top-right,
 * which is where an Israeli reader expects the week to start.
 */
export function MonthGrid({ monthDate, shifts, onSelectDay }: MonthGridProps) {
  const cells = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const byDate = useMemo(() => groupByDateKey(shifts), [shifts]);

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-bg/60">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-bold text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayShifts = byDate.get(cell.key) ?? [];
          const visible = dayShifts.slice(0, MAX_CHIPS_PER_CELL);
          const hidden = dayShifts.length - visible.length;
          const hasShifts = dayShifts.length > 0;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!hasShifts}
              onClick={() => onSelectDay(cell.date)}
              aria-label={`${formatFullDate(cell.date)} — ${
                hasShifts ? `${dayShifts.length} תורנויות` : "אין תורנויות"
              }`}
              className={cn(
                "flex min-h-20 flex-col gap-1 border-b border-s border-border p-1 text-start align-top transition-colors sm:min-h-28",
                cell.inMonth ? "bg-surface" : "bg-bg/40",
                hasShifts
                  ? "cursor-pointer hover:bg-primary/10"
                  : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  cell.isToday
                    ? "bg-primary text-primary-fg"
                    : cell.inMonth
                      ? "text-text"
                      : "text-muted/50",
                )}
              >
                {cell.date.getDate()}
              </span>

              <span className="flex w-full flex-col gap-0.5 overflow-hidden">
                {visible.map((shift) => (
                  <ShiftChip key={shift.id} shift={shift} />
                ))}
                {hidden > 0 && (
                  <span className="px-1 text-[11px] font-semibold text-muted">
                    ‏+{hidden} נוספות
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
