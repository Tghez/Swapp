import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parse,
  startOfDay,
  startOfMonth,
} from "date-fns";

/**
 * The whole of PDR §7 lives here.
 *
 * Nothing is "initialized" on the 15th — there is no roster to import, since
 * shifts are created by interns themselves. What the 15th actually does is
 * widen the window of dates a shift may be posted for, from "rest of this
 * month" to "rest of this month plus all of next month".
 */

/** Day of month from which next month becomes postable. */
export const NEXT_MONTH_OPENS_ON_DAY = 15;

export type MonthKey = string; // 'YYYY-MM'
export type DateKey = string; // 'YYYY-MM-DD'

export function monthKeyOf(date: Date): MonthKey {
  return format(date, "yyyy-MM");
}

export function dateKeyOf(date: Date): DateKey {
  return format(date, "yyyy-MM-dd");
}

/** Parses a 'YYYY-MM-DD' key as local midnight (never UTC — see note below). */
export function parseDateKey(key: DateKey): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

/** Parses a 'YYYY-MM' key as local midnight on the 1st. */
export function parseMonthKey(key: MonthKey): Date {
  return parse(key, "yyyy-MM", new Date());
}

/**
 * Note on timezones: every date here is handled in the browser's local zone,
 * via date-fns rather than `new Date('2026-08-01')` — the latter parses as UTC
 * and lands on the previous day for anyone behind UTC. Israel is UTC+2/+3 so
 * this would not bite in practice, but it would silently break for anyone
 * travelling, and it costs nothing to be correct.
 */

/** True once next month's dates may be posted. */
export function isNextMonthOpen(now: Date): boolean {
  return now.getDate() >= NEXT_MONTH_OPENS_ON_DAY;
}

/**
 * The range of dates a shift may currently be posted for:
 * today through the end of this month, extended through the end of next month
 * from the 15th onwards.
 */
export function getSelectableRange(now: Date): { min: Date; max: Date } {
  const min = startOfDay(now);
  const max = endOfMonth(isNextMonthOpen(now) ? addMonths(now, 1) : now);
  return { min, max };
}

export function isDateSelectable(candidate: Date, now: Date): boolean {
  const { min, max } = getSelectableRange(now);
  const day = startOfDay(candidate);
  return !isBefore(day, min) && !isAfter(day, max);
}

/** The months the board can navigate between, oldest first. */
export function getBrowsableMonths(now: Date): MonthKey[] {
  const months = [monthKeyOf(now)];
  if (isNextMonthOpen(now)) months.push(monthKeyOf(addMonths(now, 1)));
  return months;
}

/**
 * When a document belonging to `monthKey` should be reaped: midnight on the
 * first of the following month. An August shift therefore expires the instant
 * August ends (PDR §7).
 *
 * Firestore TTL is best-effort and can lag expiry by up to ~24h, so callers
 * must ALSO filter queries by monthKey. TTL keeps the database from growing;
 * the query filter is what guarantees nothing stale is ever rendered.
 */
export function expireAtForMonthKey(monthKey: MonthKey): Date {
  return startOfMonth(addMonths(parseMonthKey(monthKey), 1));
}

/** Hebrew month + year for headings, e.g. "אוגוסט 2026". */
const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

export function formatMonthLabel(date: Date): string {
  return `${HEBREW_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
