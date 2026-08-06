import { describe, expect, it } from "vitest";
import {
  dateKeyOf,
  expireAtForMonthKey,
  getBrowsableMonths,
  getSelectableRange,
  isDateSelectable,
  isNextMonthOpen,
  monthKeyOf,
  parseDateKey,
} from "@/lib/date/monthWindow";

/** Local-midnight constructor, matching how the app parses date keys. */
function at(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("isNextMonthOpen", () => {
  it("is closed before the 15th", () => {
    expect(isNextMonthOpen(at(2026, 8, 14))).toBe(false);
  });

  it("opens on the 15th itself, not the day after", () => {
    expect(isNextMonthOpen(at(2026, 8, 15))).toBe(true);
  });

  it("stays open for the rest of the month", () => {
    expect(isNextMonthOpen(at(2026, 8, 31))).toBe(true);
  });
});

describe("getSelectableRange", () => {
  it("stops at the end of the current month before the 15th", () => {
    const { min, max } = getSelectableRange(at(2026, 8, 14));
    expect(dateKeyOf(min)).toBe("2026-08-14");
    expect(dateKeyOf(max)).toBe("2026-08-31");
  });

  it("extends through the end of next month from the 15th", () => {
    const { max } = getSelectableRange(at(2026, 8, 15));
    expect(dateKeyOf(max)).toBe("2026-09-30");
  });

  it("never allows posting a shift in the past", () => {
    const { min } = getSelectableRange(at(2026, 8, 20));
    expect(dateKeyOf(min)).toBe("2026-08-20");
    expect(isDateSelectable(at(2026, 8, 19), at(2026, 8, 20))).toBe(false);
  });

  it("crosses the year boundary", () => {
    const { max } = getSelectableRange(at(2026, 12, 20));
    expect(dateKeyOf(max)).toBe("2027-01-31");
  });

  it("handles February in a leap year", () => {
    const { max } = getSelectableRange(at(2028, 1, 20));
    expect(dateKeyOf(max)).toBe("2028-02-29");
  });
});

describe("isDateSelectable", () => {
  const now = at(2026, 8, 20);

  it("accepts today", () => {
    expect(isDateSelectable(at(2026, 8, 20), now)).toBe(true);
  });

  it("accepts the last day of the open window", () => {
    expect(isDateSelectable(at(2026, 9, 30), now)).toBe(true);
  });

  it("rejects the day after the window closes", () => {
    expect(isDateSelectable(at(2026, 10, 1), now)).toBe(false);
  });
});

describe("getBrowsableMonths", () => {
  it("shows only the current month before the 15th", () => {
    expect(getBrowsableMonths(at(2026, 8, 14))).toEqual(["2026-08"]);
  });

  it("adds next month from the 15th", () => {
    expect(getBrowsableMonths(at(2026, 8, 15))).toEqual(["2026-08", "2026-09"]);
  });

  it("rolls into the next year in December", () => {
    expect(getBrowsableMonths(at(2026, 12, 20))).toEqual(["2026-12", "2027-01"]);
  });
});

describe("expireAtForMonthKey", () => {
  it("expires an August shift the moment August ends", () => {
    const expireAt = expireAtForMonthKey("2026-08");
    expect(dateKeyOf(expireAt)).toBe("2026-09-01");
    expect(expireAt.getHours()).toBe(0);
  });

  it("rolls December over into the next year", () => {
    expect(dateKeyOf(expireAtForMonthKey("2026-12"))).toBe("2027-01-01");
  });
});

describe("date key round-tripping", () => {
  it("parses as local time, not UTC", () => {
    // `new Date('2026-08-01')` would be UTC midnight and land on 31 July for
    // anyone behind UTC. This must stay local.
    const parsed = parseDateKey("2026-08-01");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(1);
  });

  it("round-trips through monthKeyOf", () => {
    expect(monthKeyOf(parseDateKey("2026-08-31"))).toBe("2026-08");
  });
});
