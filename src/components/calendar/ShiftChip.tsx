import { cn } from "@/lib/cn";
import {
  DEPARTMENTS,
  formatChipLabel,
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
        "flex w-full items-center gap-1 overflow-hidden rounded-md px-1 py-0.5 text-start text-[10px] font-medium leading-tight text-text",
        department.chipClass,
      )}
    >
      {/* Full opacity even though the label fades — the mark that it's
          settled should stay legible, not fade along with the rest. */}
      {handedOff && <CheckMark className="shrink-0 text-secondary-fg" />}
      {/* No truncate/ellipsis: cells are narrow enough that the "..." itself
          eats the space it's meant to save. Clip instead so every character
          that fits is shown. */}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap",
          handedOff && "opacity-45 line-through",
        )}
      >
        {formatChipLabel(shift.department, shift.internalUnit)}
      </span>
    </span>
  );
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-2.5", className)}
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
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
