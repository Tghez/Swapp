import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatPhoneForDisplay,
  normalizeIsraeliPhone,
} from "@/lib/whatsapp";

describe("normalizeIsraeliPhone", () => {
  it("maps every way an intern might type the same number to one form", () => {
    const expected = "972501234567";
    for (const input of [
      "0501234567",
      "050-1234567",
      "050 123 4567",
      "+972501234567",
      "+972-50-123-4567",
      "972501234567",
      "00972501234567",
      "+972 050 1234567", // redundant trunk zero after the country code
      "501234567",
    ]) {
      expect(normalizeIsraeliPhone(input), input).toBe(expected);
    }
  });

  it("accepts every Israeli mobile prefix", () => {
    for (const prefix of ["050", "052", "053", "054", "055", "058"]) {
      expect(normalizeIsraeliPhone(`${prefix}1234567`)).toBe(
        `972${prefix.slice(1)}1234567`,
      );
    }
  });

  it("rejects numbers that would open a dead conversation", () => {
    for (const input of [
      "",
      "   ",
      "not a phone",
      "02-1234567", // landline: no WhatsApp behind it
      "050123456", // one digit short
      "05012345678", // one digit long
      "+1 415 555 0123", // not Israeli
    ]) {
      expect(normalizeIsraeliPhone(input), input).toBeNull();
    }
  });
});

describe("formatPhoneForDisplay", () => {
  it("renders the stored E.164 form back as a local number", () => {
    expect(formatPhoneForDisplay("972501234567")).toBe("050-1234567");
  });

  it("passes through anything it cannot parse rather than blanking it", () => {
    expect(formatPhoneForDisplay("garbage")).toBe("garbage");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me link with the message encoded", () => {
    const url = buildWhatsAppUrl("050-1234567", "שלום עולם");
    expect(url).toBe(
      `https://wa.me/972501234567?text=${encodeURIComponent("שלום עולם")}`,
    );
  });

  it("encodes characters that would otherwise break the query string", () => {
    const url = buildWhatsAppUrl("0501234567", "a&b=c?d #1");
    expect(url).toContain("text=a%26b%3Dc%3Fd%20%231");
  });

  it("returns null for an unusable number so callers can disable the button", () => {
    expect(buildWhatsAppUrl("02-1234567", "hi")).toBeNull();
  });
});

describe("buildWhatsAppMessage", () => {
  const context = {
    ownerName: "טל כהן",
    takerName: "נועה לוי",
    location: "פנימית ג׳",
    dateLabel: "יום ג׳, 12 באוגוסט",
  };

  it("greets the owner by first name only", () => {
    const message = buildWhatsAppMessage(context);
    expect(message).toContain("היי טל,");
    expect(message).not.toContain("היי טל כהן");
  });

  it("names the shift being asked about", () => {
    const message = buildWhatsAppMessage(context);
    expect(message).toContain("פנימית ג׳");
    expect(message).toContain("יום ג׳, 12 באוגוסט");
    expect(message).toContain("נועה לוי");
  });

  it("copes with a single-word name", () => {
    expect(buildWhatsAppMessage({ ...context, ownerName: "טל" })).toContain(
      "היי טל,",
    );
  });
});
