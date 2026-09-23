import { describe, expect, it } from "vitest";
import {
  buildAnahHandoffEmailBody,
  buildAnahHandoffEmailUrl,
  buildAnahSwapEmailBody,
  buildAnahSwapEmailUrl,
} from "@/lib/email";

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

describe("buildAnahSwapEmailBody", () => {
  const context = {
    date: "2026-08-05",
    ownerName: "טל כהן",
    ownerEmail: "tal@example.com",
  };

  it("puts this shift's own date with a blank slot for the party taking it over", () => {
    const body = buildAnahSwapEmailBody(context);
    const firstBlock = body.split("תאריך המשמרת:")[1];
    expect(firstBlock).toContain("05/08/2026");
    expect(firstBlock).toContain("המשובץ/ת לאחר ההחלפה: \n");
  });

  it("puts the owner's own known name/email under the second, unknown date", () => {
    const body = buildAnahSwapEmailBody(context);
    const secondBlock = body.split("תאריך המשמרת:")[2];
    expect(secondBlock).toContain("המשובץ/ת לאחר ההחלפה: טל כהן");
    expect(secondBlock).toContain("מייל: tal@example.com");
    // The second shift's own date is the other party's, so the app has no
    // way to know it — it must stay blank.
    expect(secondBlock.split("\n")[0]).toBe(" ");
  });

  it("leaves every ת\"ז blank, since the app never records ID numbers", () => {
    expect(buildAnahSwapEmailBody(context).match(/ת"ז: \n/g)).toHaveLength(2);
  });
});

describe("buildAnahSwapEmailUrl", () => {
  const context = {
    date: "2026-08-05",
    ownerName: "טל כהן",
    ownerEmail: "tal@example.com",
  };

  it("opens a mailto link addressed to Anah with the swap body", () => {
    const url = buildAnahSwapEmailUrl(context);
    expect(url.startsWith("mailto:annah@tlvmc.gov.il?")).toBe(true);
    const bodyParam = new URLSearchParams(url.split("?")[1]).get("body");
    expect(bodyParam).toBe(buildAnahSwapEmailBody(context));
  });
});
