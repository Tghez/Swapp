import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { dateKeyOf, type DateKey } from "./monthWindow";

/** The Israeli week starts on Sunday, which is also date-fns' default. */
const WEEK_STARTS_ON = 0 as const;

export const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

export interface CalendarCell {
  date: Date;
  key: DateKey;
  /** False for the leading/trailing days borrowed from adjacent months. */
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Cells for a month grid, padded out to whole weeks. Length varies between 28
 * and 42 depending on the month, exactly like Google Calendar — a fixed 42
 * would leave a permanently empty trailing row in most months.
 */
export function buildMonthGrid(monthDate: Date): CalendarCell[] {
  const start = startOfWeek(startOfMonth(monthDate), {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const end = endOfWeek(endOfMonth(monthDate), {
    weekStartsOn: WEEK_STARTS_ON,
  });

  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    key: dateKeyOf(date),
    inMonth: isSameMonth(date, monthDate),
    isToday: isToday(date),
  }));
}

/** Buckets items by their date key, so each cell is an O(1) lookup. */
export function groupByDateKey<T extends { date: DateKey }>(
  items: readonly T[],
): Map<DateKey, T[]> {
  const grouped = new Map<DateKey, T[]>();
  for (const item of items) {
    const bucket = grouped.get(item.date);
    if (bucket) bucket.push(item);
    else grouped.set(item.date, [item]);
  }
  return grouped;
}

/** Long-form Hebrew date for the day-detail heading, e.g. "יום ג׳, 12 באוגוסט". */
const HEBREW_MONTHS_GENITIVE = [
  "בינואר",
  "בפברואר",
  "במרץ",
  "באפריל",
  "במאי",
  "ביוני",
  "ביולי",
  "באוגוסט",
  "בספטמבר",
  "באוקטובר",
  "בנובמבר",
  "בדצמבר",
] as const;

const HEBREW_WEEKDAYS = [
  "יום א׳",
  "יום ב׳",
  "יום ג׳",
  "יום ד׳",
  "יום ה׳",
  "יום ו׳",
  "שבת",
] as const;

export function formatFullDate(date: Date): string {
  return `${HEBREW_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${
    HEBREW_MONTHS_GENITIVE[date.getMonth()]
  }`;
}
