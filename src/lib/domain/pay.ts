import { parseDateKey, type DateKey } from "@/lib/date/monthWindow";
import type { DepartmentId } from "./departments";
import { getHoliday } from "./holidays";

/**
 * What a shift is worth, in ILS. Rates depend only on department (מיון כללי
 * pays more than every other department) and the day the shift falls on —
 * regular weekday, "Friday tier" (ערב שבת / ערב חג / חול המועד סוכות), or
 * "Saturday tier" (שבת / חג) — whichever tier the date qualifies for, taken
 * over the actual day of the week.
 *
 * חול המועד סוכות is deliberately not part of `holidays.ts`'s display table
 * (it is neither ערב nor חג there), so it gets its own hardcoded date list
 * here for pay purposes only. Extend both lists together as new years
 * approach — see holidays.ts for why this is hardcoded rather than computed.
 */
const RATES = {
  miyun_klali: { regular: 952, friday: 1071, saturday: 1428 },
  other: { regular: 714, friday: 833, saturday: 1190 },
} as const;

const CHOL_HAMOED_SUKKOT: readonly DateKey[] = [
  // 2026
  "2026-09-27",
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  // 2027
  "2027-10-17",
  "2027-10-18",
  "2027-10-19",
  "2027-10-20",
  "2027-10-21",
];

export function shiftValueILS(department: DepartmentId, date: DateKey): number {
  const rates = department === "miyun_klali" ? RATES.miyun_klali : RATES.other;
  const holiday = getHoliday(date);
  if (holiday?.kind === "chag") return rates.saturday;
  if (holiday?.kind === "erev" || CHOL_HAMOED_SUKKOT.includes(date)) return rates.friday;
  const day = parseDateKey(date).getDay(); // 0 = Sunday ... 6 = Saturday
  if (day === 6) return rates.saturday;
  if (day === 5) return rates.friday;
  return rates.regular;
}

/** e.g. 1071 -> "1,071 ₪". */
export function formatILS(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ₪`;
}
