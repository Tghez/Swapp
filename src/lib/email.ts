/**
 * mailto: deep link for the מיון כללי handoff-approval email Anah requires.
 * A plain mailto (rather than a mail.google.com web URL) is what lets the OS
 * hand this off to whichever mail app is installed — Gmail's app included —
 * instead of always forcing Gmail's website open in a browser tab. Nothing
 * is ever sent from the app, and the owner still has to fill in the ת"ז
 * fields and every מחליף/ה detail by hand, since the app never records who
 * takes a shift (see MyShiftsSidebar's known gaps).
 */

const ANAH_EMAIL = "annah@tlvmc.gov.il";

export interface AnahHandoffEmailContext {
  /** 'YYYY-MM-DD' */
  date: string;
  ownerName: string;
  ownerEmail: string;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' by string surgery — no Date parsing, no UTC gotcha. */
function toIsraeliDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
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

/**
 * Opened via a real <a>, never window.open — same rule as the wa.me links.
 *
 * Built with encodeURIComponent rather than URLSearchParams: the latter
 * encodes spaces as '+', which plenty of mail clients paste into the body
 * literally instead of decoding back to a space.
 */
export function buildAnahHandoffEmailUrl(context: AnahHandoffEmailContext): string {
  const subject = encodeURIComponent("מסירת משמרת - בקשה לאישור");
  const body = encodeURIComponent(buildAnahHandoffEmailBody(context));
  return `mailto:${ANAH_EMAIL}?subject=${subject}&body=${body}`;
}
