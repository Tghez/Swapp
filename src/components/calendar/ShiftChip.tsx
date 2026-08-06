import { cn } from "@/lib/cn";
import {
  DEPARTMENTS,
  formatLocation,
  getDepartment,
} from "@/lib/domain/departments";
import type { Shift } from "@/lib/domain/types";

/**
 * One shift as it appears inside a calendar cell.
 *
 * Colour marks the department, but the name is always written out too — on a
 * dense month grid, and for anyone who cannot separate the hues, colour alone
 * would carry meaning nothing else does.
 */
export function ShiftChip({ shift }: { shift: Shift }) {
  const department = getDepartment(shift.department);
  const handedOff = shift.status === "handedOff";

  return (
    <span
      className={cn(
        "flex w-full items-center gap-1 overflow-hidden rounded-md border-s-4 px-1.5 py-0.5 text-start text-[11px] font-medium leading-tight text-text",
        department.chipClass,
        handedOff && "opacity-45 line-through",
      )}
    >
      {shift.urgent && !handedOff && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-urgent"
        />
      )}
      {shift.willingToSwap && !handedOff && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-secondary"
        />
      )}
      <span className="truncate">
        {formatLocation(shift.department, shift.internalUnit)}
      </span>
    </span>
  );
}

/** Legend for the calendar's colour coding (PDR §6.3). */
export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {DEPARTMENTS.map((department) => (
        <li
          key={department.id}
          className="flex items-center gap-1.5 text-xs text-muted"
        >
          <span className={cn("size-2.5 rounded-full", department.dotClass)} />
          {department.label}
        </li>
      ))}
    </ul>
  );
}
