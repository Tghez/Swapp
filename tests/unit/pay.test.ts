import { describe, expect, it } from "vitest";
import { formatILS, shiftValueILS } from "@/lib/domain/pay";

describe("shiftValueILS", () => {
  it("pays מיון כללי more than every other department", () => {
    // 2026-08-10 is a Monday (regular weekday)
    expect(shiftValueILS("miyun_klali", "2026-08-10")).toBe(952);
    expect(shiftValueILS("pnimit", "2026-08-10")).toBe(714);
    expect(shiftValueILS("miyun_yeladim", "2026-08-10")).toBe(714);
    expect(shiftValueILS("kirurgia", "2026-08-10")).toBe(714);
  });

  it("bumps the rate on Friday", () => {
    // 2026-08-14 is a Friday
    expect(shiftValueILS("miyun_klali", "2026-08-14")).toBe(1071);
    expect(shiftValueILS("pnimit", "2026-08-14")).toBe(833);
  });

  it("bumps the rate further on Saturday", () => {
    // 2026-08-15 is a Saturday
    expect(shiftValueILS("miyun_klali", "2026-08-15")).toBe(1428);
    expect(shiftValueILS("pnimit", "2026-08-15")).toBe(1190);
  });
});

describe("formatILS", () => {
  it("formats with a thousands separator and the ₪ sign", () => {
    expect(formatILS(1071)).toBe("1,071 ₪");
    expect(formatILS(714)).toBe("714 ₪");
  });
});
