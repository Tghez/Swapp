/**
 * WhatsApp deep linking (PDR §9.5) — a plain wa.me link, no Business API,
 * no server call, no key.
 */

/** Israeli mobile in E.164 without the leading '+': 972 5X XXXXXXX. */
const E164_IL_MOBILE = /^9725\d{8}$/;

/**
 * Normalises the many ways an intern might type their own number into the one
 * form wa.me accepts.
 *
 *   050-123-4567     → 972501234567
 *   +972 50 1234567  → 972501234567
 *   00972501234567   → 972501234567
 *   501234567        → 972501234567
 *
 * Returns null for anything that is not a valid Israeli mobile. Landlines are
 * rejected on purpose: a wa.me link to one opens a dead conversation, which is
 * a worse failure than refusing the number at the point of entry.
 */
export function normalizeIsraeliPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("972")) {
    // Tolerate the redundant trunk zero in '+972 050…'
    const rest = digits.slice(3);
    digits = rest.startsWith("0") ? `972${rest.slice(1)}` : digits;
  } else if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  } else {
    digits = `972${digits}`;
  }

  return E164_IL_MOBILE.test(digits) ? digits : null;
}

export function isValidIsraeliPhone(raw: string): boolean {
  return normalizeIsraeliPhone(raw) !== null;
}

/** Display form for a stored E.164 number, e.g. "050-1234567". */
export function formatPhoneForDisplay(raw: string): string {
  const normalized = normalizeIsraeliPhone(raw);
  if (!normalized) return raw;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 3)}-${local.slice(3)}`;
}

export interface WhatsAppMessageContext {
  ownerName: string;
  location: string;
  dateLabel: string;
}

/** The message pre-filled into the conversation. Kept short and specific. */
export function buildWhatsAppMessage({
  ownerName,
  location,
  dateLabel,
}: WhatsAppMessageContext): string {
  const owner = ownerName.trim().split(/\s+/)[0] || ownerName.trim();
  return (
    `היי ${owner} ראיתי שאת/ה מוסר תורנות ב${location} ב${dateLabel}. ` +
    `אני מעוניינ/ת, האם רלוונטי?`
  );
}

/**
 * Builds the deep link. Returns null when the owner's number is unusable, so
 * callers can disable the button instead of opening a broken chat.
 */
export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
