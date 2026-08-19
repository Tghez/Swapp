import { describe, expect, it } from "vitest";
import { getHoliday } from "@/lib/domain/holidays";

describe("getHoliday", () => {
  it("returns the חג for a known date", () => {
    expect(getHoliday("2026-04-02")).toEqual({ label: "פסח", kind: "chag" });
  });

  it("gives ערב the same name as the חג it leads into", () => {
    expect(getHoliday("2026-04-01")).toEqual({ label: "פסח", kind: "erev" });
  });

  it("returns null for chol hamoed, which is neither ערב nor חג", () => {
    expect(getHoliday("2026-04-04")).toBeNull();
  });

  it("returns null for an ordinary day", () => {
    expect(getHoliday("2026-08-12")).toBeNull();
  });

  it("marks both days of ראש השנה as חג", () => {
    expect(getHoliday("2026-09-12")?.kind).toBe("chag");
    expect(getHoliday("2026-09-13")?.kind).toBe("chag");
  });

  it("labels Sukkot and Shmini Atzeret as one two-part festival", () => {
    expect(getHoliday("2026-09-25")?.label).toBe("סוכות א׳");
    expect(getHoliday("2026-09-26")?.label).toBe("סוכות א׳");
    expect(getHoliday("2026-10-02")?.label).toBe("סוכות ב׳");
    expect(getHoliday("2026-10-03")?.label).toBe("סוכות ב׳");
  });
});
