import { describe, expect, it } from "vitest";
import { buildAnahHandoffEmailBody, buildAnahHandoffEmailUrl } from "@/lib/email";

describe("buildAnahHandoffEmailBody", () => {
  const context = {
    date: "2026-08-05",
    ownerName: "טל כהן",
    ownerEmail: "tal@example.com",
  };

  it("writes the shift date in Israeli DD/MM/YYYY order", () => {
    expect(buildAnahHandoffEmailBody(context)).toContain(
      "תאריך המשמרת: 05/08/2026",
    );
  });

  it("fills in the owner's known name and email", () => {
    const body = buildAnahHandoffEmailBody(context);
    expect(body).toContain("המציע/ה: טל כהן");
    expect(body).toContain("מייל: tal@example.com");
  });

  it("leaves ת\"ז and every מחליף/ה field blank, since the app never records them", () => {
    const body = buildAnahHandoffEmailBody(context);
    expect(body).toContain("המחליף/ה: \n");
    expect(body.match(/ת"ז: \n/g)).toHaveLength(2);
  });
});

describe("buildAnahHandoffEmailUrl", () => {
  const context = {
    date: "2026-08-05",
    ownerName: "טל כהן",
    ownerEmail: "tal@example.com",
  };

  it("opens a mailto link addressed to Anah, so the OS picks the mail app", () => {
    const url = buildAnahHandoffEmailUrl(context);
    expect(url.startsWith("mailto:annah@tlvmc.gov.il?")).toBe(true);
  });

  it("encodes the body without turning spaces into literal '+' signs", () => {
    const url = buildAnahHandoffEmailUrl(context);
    const bodyParam = new URLSearchParams(url.split("?")[1]).get("body");
    expect(bodyParam).toBe(buildAnahHandoffEmailBody(context));
    expect(url).not.toContain("+");
  });
});
