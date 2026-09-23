/**
 * mailto: deep links for the two Anah (מלר"ד) approval emails a מיון כללי
 * handoff needs — a straight one-way handoff, or a head-to-head swap where
 * two people trade shifts. A plain mailto (rather than a mail.google.com web
 * URL) is what lets the OS hand this off to whichever mail app is installed
 * — Gmail's app included — instead of always forcing Gmail's website open in
 * a browser tab. Nothing is ever sent from the app, and the owner still has
 * to fill in every blank field by hand: the app only ever knows this one
 * shift's own date and its owner's name/email, never who the other party is
 * or what their shift's date is (see MyShiftsSidebar's known gaps).
 */

const ANAH_EMAIL = "annah@tlvmc.gov.il";

export interface AnahHandoffEmailContext {
  /**
   * 'YYYY-MM-DD', or omitted when the email isn't about one particular
   * shift yet — the general "מה עכשיו" guidance links use these same
   * templates with the date left blank for the intern to fill in.
   */
  date?: string;
  ownerName: string;
  ownerEmail: string;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' by string surgery — no Date parsing, no UTC gotcha. */
function toIsraeliDate(dateKey: string | undefined): string {
  if (!dateKey) return "";
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Built with encodeURIComponent rather than URLSearchParams: the latter
 * encodes spaces as '+', which plenty of mail clients paste into the body
 * literally instead of decoding back to a space.
 */
function buildAnahMailtoUrl(subject: string, body: string): string {
  return `mailto:${ANAH_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildAnahHandoffEmailBody({
  date,
  ownerName,
  ownerEmail,
}: AnahHandoffEmailContext): string {
  return (
    `שלום אנה,\n\n` +
    `מבקשים לעדכן על מסירת משמרת:\n\n` +
    `תאריך המשמרת: ${toIsraeliDate(date)}\n\n` +
    `המציע/ה: ${ownerName}\n` +
    `ת"ז: \n` +
    `מייל: ${ownerEmail}\n\n` +
    `המחליף/ה: \n` +
    `ת"ז: \n` +
    `מייל: \n\n` +
    `נשמח לקבל את אישורך להחלפה.\n\n` +
    `תודה רבה!`
  );
}

/** Opened via a real <a>, never window.open — same rule as the wa.me links. */
export function buildAnahHandoffEmailUrl(context: AnahHandoffEmailContext): string {
  return buildAnahMailtoUrl(
    "מסירת משמרת - בקשה לאישור",
    buildAnahHandoffEmailBody(context),
  );
}

/**
 * The head-to-head swap: this shift's own date goes with the other party
 * (unknown) who takes it over, and the owner's own known name/email goes
 * with the *other* shift's date — which the app has no record of at all.
 */
export function buildAnahSwapEmailBody({
  date,
  ownerName,
  ownerEmail,
}: AnahHandoffEmailContext): string {
  return (
    `שלום אנה,\n\n` +
    `מבקשים לעדכן על החלפת משמרות הדדית:\n\n` +
    `תאריך המשמרת: ${toIsraeliDate(date)}\n` +
    `המשובץ/ת לאחר ההחלפה: \n` +
    `ת"ז: \n` +
    `מייל: \n\n` +
    `תאריך המשמרת: \n` +
    `המשובץ/ת לאחר ההחלפה: ${ownerName}\n` +
    `ת"ז: \n` +
    `מייל: ${ownerEmail}\n\n` +
    `נשמח לקבל את אישורך להחלפה.\n\n` +
    `תודה רבה!`
  );
}

/** Opened via a real <a>, never window.open — same rule as the wa.me links. */
export function buildAnahSwapEmailUrl(context: AnahHandoffEmailContext): string {
  return buildAnahMailtoUrl(
    "החלפת משמרות - בקשה לאישור",
    buildAnahSwapEmailBody(context),
  );
}
