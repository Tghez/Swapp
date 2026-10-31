import { describe, expect, it } from "vitest";
import { evaluateQuota } from "@/lib/domain/quota";
import type { Quota } from "@/lib/domain/types";

function quota(overrides: Partial<Quota> = {}): Quota {
  return {
    uid: "bob-uid",
    monthKey: "2026-08",
    dates: {},
    urgentShiftId: null,
    ...overrides,
  };
}

describe("evaluateQuota", () => {
  it("blocks nothing when there is no quota yet this month", () => {
    expect(evaluateQuota(null, "2026-08-25")).toEqual({
      dailyBlocked: false,
      urgentBlocked: false,
    });
  });

  it("blocks the daily check only for a date already claimed", () => {
    const q = quota({ dates: { "2026-08-25": true } });
    expect(evaluateQuota(q, "2026-08-25").dailyBlocked).toBe(true);
    expect(evaluateQuota(q, "2026-08-26").dailyBlocked).toBe(false);
  });

  it("does not cap how many shifts a month may hold", () => {
    const many = quota({
      dates: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`2026-08-0${i + 1}`, true]),
      ),
    });
    expect(evaluateQuota(many, "2026-08-20")).toEqual({
      dailyBlocked: false,
      urgentBlocked: false,
    });
  });

  it("blocks the urgent check once an urgent shift is on the books", () => {
    const q = quota({ urgentShiftId: "shift-1" });
    expect(evaluateQuota(q, "2026-08-25").urgentBlocked).toBe(true);
    expect(evaluateQuota(quota(), "2026-08-25").urgentBlocked).toBe(false);
  });

  it("evaluates both checks independently", () => {
    const q = quota({
      dates: { "2026-08-25": true },
      urgentShiftId: "shift-1",
    });
    expect(evaluateQuota(q, "2026-08-25")).toEqual({
      dailyBlocked: true,
      urgentBlocked: true,
    });
  });
});
