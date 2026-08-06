import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatFullDate,
  groupByDateKey,
  WEEKDAY_LABELS,
} from "@/lib/date/calendar";
import { formatLocation } from "@/lib/domain/departments";

describe("buildMonthGrid", () => {
  it("starts the week on Sunday, as the Israeli week does", () => {
    expect(WEEKDAY_LABELS[0]).toBe("א");
    const grid = buildMonthGrid(new Date(2026, 7, 1));
    expect(grid[0].date.getDay()).toBe(0);
  });

  it("covers whole weeks", () => {
    for (const month of [0, 1, 5, 8, 11]) {
      const grid = buildMonthGrid(new Date(2026, month, 1));
      expect(grid.length % 7).toBe(0);
    }
  });

  it("includes every day of the month exactly once", () => {
    const grid = buildMonthGrid(new Date(2026, 7, 1)); // August: 31 days
    const inMonth = grid.filter((cell) => cell.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth.map((cell) => cell.key)).size).toBe(31);
  });

  it("marks padding days from adjacent months as out of month", () => {
    // 1 August 2026 is a Saturday, so the grid opens with six July days.
    const grid = buildMonthGrid(new Date(2026, 7, 1));
    expect(grid[0].inMonth).toBe(false);
    expect(grid[0].key).toBe("2026-07-26");
  });

  it("handles a leap February", () => {
    const grid = buildMonthGrid(new Date(2028, 1, 1));
    expect(grid.filter((cell) => cell.inMonth)).toHaveLength(29);
  });
});

describe("groupByDateKey", () => {
  it("buckets items by their date", () => {
    const grouped = groupByDateKey([
      { date: "2026-08-01", id: "a" },
      { date: "2026-08-01", id: "b" },
      { date: "2026-08-02", id: "c" },
    ]);
    expect(grouped.get("2026-08-01")).toHaveLength(2);
    expect(grouped.get("2026-08-02")).toHaveLength(1);
    expect(grouped.get("2026-08-03")).toBeUndefined();
  });
});

describe("formatFullDate", () => {
  it("renders a Hebrew weekday and date", () => {
    // 12 August 2026 is a Wednesday — יום ד׳.
    expect(formatFullDate(new Date(2026, 7, 12))).toBe("יום ד׳, 12 באוגוסט");
  });

  it("names Saturday without the יום prefix", () => {
    expect(formatFullDate(new Date(2026, 7, 1))).toBe("שבת, 1 באוגוסט");
  });
});

describe("formatLocation", () => {
  it("appends the unit for פנימית", () => {
    expect(formatLocation("pnimit", "gimel")).toBe("פנימית ג׳");
    expect(formatLocation("pnimit", "geriatric")).toBe("פנימית גריאטרית");
  });

  it("ignores a unit on a department that has none", () => {
    expect(formatLocation("kirurgia", "gimel")).toBe("כירורגיה");
  });

  it("degrades to the bare department when the unit is missing", () => {
    expect(formatLocation("pnimit", null)).toBe("פנימית");
  });
});
