import { describe, expect, it } from "vitest";
import { countWords, createHandoffSchema } from "@/lib/domain/schemas";
import type {
  DepartmentId,
  PnimitUnitId,
} from "@/lib/domain/departments";

const NOW = new Date(2026, 7, 20, 12, 0, 0); // 20 August 2026 — window is open

interface HandoffInputShape {
  displayName: string;
  phone: string;
  email: string;
  date: string;
  department: DepartmentId;
  internalUnit: PnimitUnitId | null;
  note: string;
  urgent: boolean;
}

const VALID: HandoffInputShape = {
  displayName: "טל כהן",
  phone: "050-1234567",
  email: "TAL@Example.com",
  date: "2026-08-25",
  department: "miyun_klali",
  internalUnit: null,
  note: "",
  urgent: false,
};

function parse(overrides: Partial<HandoffInputShape> = {}) {
  return createHandoffSchema(NOW).safeParse({ ...VALID, ...overrides });
}

function errorFor(result: ReturnType<typeof parse>, field: string) {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("countWords", () => {
  it("counts Hebrew words", () => {
    expect(countWords("צריך למסור בדחיפות")).toBe(3);
  });

  it("does not inflate on runs of whitespace or newlines", () => {
    expect(countWords("  שתי   מילים  \n ")).toBe(2);
  });

  it("does not split a word on attached punctuation", () => {
    expect(countWords("שלום, מה נשמע?")).toBe(3);
  });

  it("counts nothing for an empty or blank string", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("handoff schema", () => {
  it("accepts a well-formed submission", () => {
    const result = parse();
    expect(result.success).toBe(true);
  });

  it("canonicalises phone and email so every read site agrees", () => {
    const result = parse();
    if (!result.success) throw new Error("expected success");
    expect(result.data.phone).toBe("972501234567");
    expect(result.data.email).toBe("tal@example.com");
  });

  it("turns an empty note into null rather than an empty string", () => {
    const result = parse({ note: "   " });
    if (!result.success) throw new Error("expected success");
    expect(result.data.note).toBeNull();
  });

  describe("note length", () => {
    it("accepts exactly 15 words", () => {
      expect(parse({ note: Array(15).fill("מילה").join(" ") }).success).toBe(
        true,
      );
    });

    it("rejects 16", () => {
      const result = parse({ note: Array(16).fill("מילה").join(" ") });
      expect(errorFor(result, "note")).toBe("עד 15 מילים");
    });
  });

  describe("the date window", () => {
    it("rejects a date in the past", () => {
      expect(errorFor(parse({ date: "2026-08-19" }), "date")).toBeTruthy();
    });

    it("accepts next month, since it is past the 15th", () => {
      expect(parse({ date: "2026-09-30" }).success).toBe(true);
    });

    it("rejects the month after next", () => {
      expect(errorFor(parse({ date: "2026-10-01" }), "date")).toBeTruthy();
    });

    it("rejects next month before the 15th", () => {
      const early = createHandoffSchema(new Date(2026, 7, 10, 12));
      const result = early.safeParse({ ...VALID, date: "2026-09-05" });
      expect(result.success).toBe(false);
    });
  });

  describe("פנימית units", () => {
    it("requires a unit when the department is פנימית", () => {
      const result = parse({ department: "pnimit", internalUnit: null });
      expect(errorFor(result, "internalUnit")).toBe("נא לבחור פנימית");
    });

    it("accepts פנימית with a unit", () => {
      expect(parse({ department: "pnimit", internalUnit: "gimel" }).success).toBe(
        true,
      );
    });

    it("drops a unit left over from switching department", () => {
      const result = parse({
        department: "kirurgia",
        internalUnit: "gimel",
      });
      if (!result.success) throw new Error("expected success");
      expect(result.data.internalUnit).toBeNull();
    });
  });

  describe("field validation", () => {
    it("rejects a landline, which has no WhatsApp behind it", () => {
      expect(errorFor(parse({ phone: "02-1234567" }), "phone")).toBe(
        "מספר טלפון נייד לא תקין",
      );
    });

    it("rejects a malformed email", () => {
      expect(errorFor(parse({ email: "nope" }), "email")).toBeTruthy();
    });

    it("rejects a one-character name", () => {
      expect(errorFor(parse({ displayName: "ט" }), "displayName")).toBeTruthy();
    });

    it("rejects an unknown department", () => {
      const result = parse({ department: "cardiology" as DepartmentId });
      expect(errorFor(result, "department")).toBeTruthy();
    });
  });
});
