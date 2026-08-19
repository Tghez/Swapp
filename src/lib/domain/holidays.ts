import type { DateKey } from "@/lib/date/monthWindow";

/**
 * Jewish holidays that carry work restrictions in Israel (חג / יום טוב) plus
 * their ערב — not Purim, Chanukah, Tish'a B'Av, or civil holidays, none of
 * which restrict work. Chol HaMoed (the intermediate days of Pesach and
 * Sukkot) is deliberately absent: it is neither ערב nor חג.
 *
 * ערב and חג share the same displayed name (e.g. both the eve and the day of
 * יום כיפור read "יום כיפור") — `kind` still records which is which, but the
 * month grid has no room for "ערב" as a prefix on top of the name itself.
 * Sukkot and Shmini Atzeret/Simchat Torah are displayed as one two-part
 * festival, "סוכות א׳" / "סוכות ב׳", rather than under their separate
 * halachic names.
 *
 * Hebrew-calendar dates shift every Gregorian year, so this is a hardcoded
 * table rather than computed — extend it as new years approach. The board
 * only ever shows the current month plus, from the 15th, next month, so this
 * needs to stay only a year or two ahead of "today", not forever.
 * Source: hebcal.com, Israel schedule.
 */
export type HolidayKind = "erev" | "chag";

export interface Holiday {
  label: string;
  kind: HolidayKind;
}

const HOLIDAYS_BY_DATE: Record<DateKey, Holiday> = {
  // 2026
  "2026-04-01": { label: "פסח", kind: "erev" },
  "2026-04-02": { label: "פסח", kind: "chag" },
  "2026-04-07": { label: "שביעי של פסח", kind: "erev" },
  "2026-04-08": { label: "שביעי של פסח", kind: "chag" },
  "2026-05-21": { label: "שבועות", kind: "erev" },
  "2026-05-22": { label: "שבועות", kind: "chag" },
  "2026-09-11": { label: "ראש השנה", kind: "erev" },
  "2026-09-12": { label: "ראש השנה", kind: "chag" },
  "2026-09-13": { label: "ראש השנה", kind: "chag" },
  "2026-09-20": { label: "יום כיפור", kind: "erev" },
  "2026-09-21": { label: "יום כיפור", kind: "chag" },
  "2026-09-25": { label: "סוכות א׳", kind: "erev" },
  "2026-09-26": { label: "סוכות א׳", kind: "chag" },
  "2026-10-02": { label: "סוכות ב׳", kind: "erev" },
  "2026-10-03": { label: "סוכות ב׳", kind: "chag" },

  // 2027
  "2027-04-21": { label: "פסח", kind: "erev" },
  "2027-04-22": { label: "פסח", kind: "chag" },
  "2027-04-27": { label: "שביעי של פסח", kind: "erev" },
  "2027-04-28": { label: "שביעי של פסח", kind: "chag" },
  "2027-06-10": { label: "שבועות", kind: "erev" },
  "2027-06-11": { label: "שבועות", kind: "chag" },
  "2027-10-01": { label: "ראש השנה", kind: "erev" },
  "2027-10-02": { label: "ראש השנה", kind: "chag" },
  "2027-10-03": { label: "ראש השנה", kind: "chag" },
  "2027-10-10": { label: "יום כיפור", kind: "erev" },
  "2027-10-11": { label: "יום כיפור", kind: "chag" },
  "2027-10-15": { label: "סוכות א׳", kind: "erev" },
  "2027-10-16": { label: "סוכות א׳", kind: "chag" },
  "2027-10-22": { label: "סוכות ב׳", kind: "erev" },
  "2027-10-23": { label: "סוכות ב׳", kind: "chag" },
};

export function getHoliday(key: DateKey): Holiday | null {
  return HOLIDAYS_BY_DATE[key] ?? null;
}
