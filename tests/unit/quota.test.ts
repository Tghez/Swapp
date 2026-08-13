import { describe, expect, it } from "vitest";
import { evaluateQuota, MAX_SHIFTS_PER_MONTH } from "@/lib/domain/quota";
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
      monthlyBlocked: false,
      urgentBlocked: false,
    });
  });

  it("blocks the daily check only for a date already claimed", () => {
    const q = quota({ dates: { "2026-08-25": true } });
    expect(evaluateQuota(q, "2026-08-25").dailyBlocked).toBe(true);
    expect(evaluateQuota(q, "2026-08-26").dailyBlocked).toBe(false);
  });

  it("blocks the monthly check once the cap is reached", () => {
    const under = quota({
      dates: { "2026-08-01": true, "2026-08-02": true, "2026-08-03": true },
    });
    expect(evaluateQuota(under, "2026-08-10").monthlyBlocked).toBe(false);

    const atCap = quota({
      dates: Object.fromEntries(
        Array.from({ length: MAX_SHIFTS_PER_MONTH }, (_, i) => [
          `2026-08-0${i + 1}`,
          true,
        ]),
      ),
    });
    expect(evaluateQuota(atCap, "2026-08-10").monthlyBlocked).toBe(true);
  });

  it("blocks the urgent check once an urgent shift is on the books", () => {
    const q = quota({ urgentShiftId: "shift-1" });
    expect(evaluateQuota(q, "2026-08-25").urgentBlocked).toBe(true);
    expect(evaluateQuota(quota(), "2026-08-25").urgentBlocked).toBe(false);
  });

  it("evaluates all three checks independently", () => {
    const q = quota({
      dates: { "2026-08-25": true },
      urgentShiftId: "shift-1",
    });
    expect(evaluateQuota(q, "2026-08-25")).toEqual({
      dailyBlocked: true,
      monthlyBlocked: false,
      urgentBlocked: true,
    });
  });
});
