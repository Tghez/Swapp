import { parseDateKey, type DateKey } from "@/lib/date/monthWindow";
import type { DepartmentId } from "./departments";

/**
 * What a shift is worth, in ILS. Rates depend only on department (מיון כללי
 * pays more than every other department) and the day of the week the shift
 * falls on — regular weekday, Friday, or Saturday.
 */
const RATES = {
  miyun_klali: { regular: 952, friday: 1071, saturday: 1428 },
  other: { regular: 714, friday: 833, saturday: 1190 },
} as const;

export function shiftValueILS(department: DepartmentId, date: DateKey): number {
  const rates = department === "miyun_klali" ? RATES.miyun_klali : RATES.other;
  const day = parseDateKey(date).getDay(); // 0 = Sunday ... 6 = Saturday
  if (day === 6) return rates.saturday;
  if (day === 5) return rates.friday;
  return rates.regular;
}

/** e.g. 1071 -> "1,071 ₪". */
export function formatILS(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ₪`;
}
