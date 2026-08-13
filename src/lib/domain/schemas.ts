import { z } from "zod";
import { DEPARTMENT_IDS, PNIMIT_UNIT_IDS } from "./departments";
import { isDateSelectable, parseDateKey } from "@/lib/date/monthWindow";
import { isValidIsraeliPhone, normalizeIsraeliPhone } from "@/lib/whatsapp";

/** Max words in the "משהו להוסיף" free-text field (PDR §6.2). */
export const NOTE_MAX_WORDS = 15;

/**
 * Max bytes in the note, mirroring `firestore.rules`' `note.size() <= 300` —
 * Firestore's `size()` on a string counts UTF-8 bytes, not JS `.length`
 * (UTF-16 code units), so a run of Hebrew text or a single long unspaced word
 * can pass the word-count check above and still exceed this independently.
 */
export const NOTE_MAX_BYTES = 300;

/**
 * Counts words in a way that behaves for Hebrew: split on whitespace, ignore
 * empties. Punctuation attached to a word does not make it two words, and
 * runs of spaces or newlines do not inflate the count.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** UTF-8 byte length, matching Firestore rules' `string.size()`. */
export function noteByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const nameSchema = z
  .string()
  .trim()
  .min(2, "נא להזין שם מלא")
  .max(60, "השם ארוך מדי");

const phoneSchema = z
  .string()
  .trim()
  .min(1, "נא להזין מספר טלפון")
  .refine(isValidIsraeliPhone, "מספר טלפון נייד לא תקין")
  // Store the canonical form so every read site gets the same string.
  .transform((value) => normalizeIsraeliPhone(value)!);

const emailSchema = z
  .string()
  .trim()
  .min(1, "נא להזין אימייל")
  .pipe(z.email("כתובת אימייל לא תקינה"))
  .transform((value) => value.toLowerCase());

const noteSchema = z
  .string()
  .trim()
  .refine(
    (value) => countWords(value) <= NOTE_MAX_WORDS,
    `עד ${NOTE_MAX_WORDS} מילים`,
  )
  .refine((value) => noteByteLength(value) <= NOTE_MAX_BYTES, "ההערה ארוכה מדי")
  .transform((value) => (value === "" ? null : value));

export const profileSchema = z.object({
  displayName: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
});

export type ProfileFormValues = z.input<typeof profileSchema>;

/**
 * The handing-off form (PDR §6.2), plus the date field the PDR omits — §6.3
 * renders a month calendar, so a shift cannot exist without one.
 *
 * Built as a factory because validity depends on "now": which dates are
 * postable widens on the 15th. Passing the clock in keeps the rule testable
 * without faking timers.
 */
export function createHandoffSchema(now: Date) {
  return z
    .object({
      displayName: nameSchema,
      phone: phoneSchema,
      email: emailSchema,
      date: z
        .string()
        .regex(DATE_KEY, "נא לבחור תאריך")
        .refine(
          (value) => isDateSelectable(parseDateKey(value), now),
          "התאריך מחוץ לטווח שניתן לפרסם כרגע",
        ),
      department: z.enum(DEPARTMENT_IDS, { message: "נא לבחור מחלקה" }),
      internalUnit: z.enum(PNIMIT_UNIT_IDS).nullable().default(null),
      note: noteSchema.default(""),
      urgent: z.boolean().default(false),
      willingToSwap: z.boolean().default(false),
    })
    .superRefine((values, ctx) => {
      if (values.department === "pnimit" && !values.internalUnit) {
        ctx.addIssue({
          code: "custom",
          path: ["internalUnit"],
          message: "נא לבחור פנימית",
        });
      }
    })
    .transform((values) => ({
      ...values,
      // A unit only means something for פנימית; drop a stale selection left
      // behind by switching departments after picking one.
      internalUnit: values.department === "pnimit" ? values.internalUnit : null,
    }));
}

export type HandoffSchema = ReturnType<typeof createHandoffSchema>;
export type HandoffFormValues = z.input<HandoffSchema>;
export type HandoffParsedValues = z.output<HandoffSchema>;
