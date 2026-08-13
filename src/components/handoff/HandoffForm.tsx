"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  CheckboxField,
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { ErrorBanner, Spinner } from "@/components/ui/Feedback";
import { DEPARTMENTS, PNIMIT_UNITS } from "@/lib/domain/departments";
import {
  countWords,
  createHandoffSchema,
  NOTE_MAX_BYTES,
  NOTE_MAX_WORDS,
  noteByteLength,
} from "@/lib/domain/schemas";
import { evaluateQuota } from "@/lib/domain/quota";
import {
  dateKeyOf,
  getSelectableRange,
  monthKeyOf,
  parseDateKey,
} from "@/lib/date/monthWindow";
import { createShift } from "@/lib/data/shifts";
import { useNow, useQuota } from "@/hooks/useShiftData";

interface FormState {
  displayName: string;
  phone: string;
  email: string;
  date: string;
  department: string;
  internalUnit: string;
  note: string;
  urgent: boolean;
  willingToSwap: boolean;
}

const BLANK: FormState = {
  displayName: "",
  phone: "",
  email: "",
  date: "",
  department: "",
  internalUnit: "",
  note: "",
  urgent: false,
  willingToSwap: false,
};

export function HandoffForm() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const now = useNow();

  const [edits, setEdits] = useState<Partial<FormState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showUrgentTip, setShowUrgentTip] = useState(false);

  const range = useMemo(() => getSelectableRange(now), [now]);
  const schema = useMemo(() => createHandoffSchema(now), [now]);

  /**
   * Autofill (PDR §4): the saved profile wins, since that is what the intern
   * typed themselves. On the very first visit there is no profile yet — the
   * name field starts blank rather than falling back to Google's, since that
   * is often an English name and this is the one field the intern should
   * type themselves in Hebrew. Email and phone still fall back to Google
   * where available; phone never comes from Google, so it is always typed
   * once regardless.
   *
   * These are defaults rather than initial state, and what the intern types is
   * held separately as `edits`. That way the fields fill in the moment the
   * profile arrives without an effect copying it into state, and without
   * clobbering anything already typed while it was loading.
   */
  const defaults = useMemo<FormState>(
    () => ({
      ...BLANK,
      displayName: profile?.displayName || "",
      phone: profile?.phone || "",
      email: profile?.email || user?.email || "",
    }),
    [profile, user],
  );

  const values: FormState = { ...defaults, ...edits };

  const selectedDepartment = DEPARTMENTS.find((d) => d.id === values.department);
  const showUnitPicker = selectedDepartment?.hasUnits ?? false;

  const targetMonthKey = values.date
    ? monthKeyOf(parseDateKey(values.date))
    : null;

  /**
   * The live pre-check: one small doc per intern per month covers all three
   * posting limits at once (`firestore.rules`' `quotas/{uid}__{monthKey}`),
   * so this subscription is the single source of truth the submit button is
   * gated on — no more deriving limits by scanning `myShifts`, which could
   * go stale in a long-lived tab (a frozen "now" would leave the month
   * window it filters against frozen too).
   *
   * Suppressed while `submitting`: the moment a post succeeds, this same
   * subscription picks up the just-written quota — before `router.push` has
   * navigated away — which would otherwise flash a false "limit reached" for
   * the shift the intern is in the middle of successfully posting.
   * `submitting` only clears on failure, so a genuine conflict still shows
   * before the next attempt.
   */
  const { data: quota, loading: quotaLoading } = useQuota(user?.uid, targetMonthKey);
  const evaluation =
    !submitting && values.date ? evaluateQuota(quota, values.date) : null;
  const dailyBlocked = evaluation?.dailyBlocked ?? false;
  const monthlyBlocked = evaluation?.monthlyBlocked ?? false;
  const urgentBlocked = evaluation?.urgentBlocked ?? false;

  // Derived, not corrected after the fact: ticking the box and then moving to
  // a date whose month is already spent must not submit an urgent flag the
  // server would reject.
  const urgent = values.urgent && !urgentBlocked;

  const noteWords = countWords(values.note);
  const noteBytes = noteByteLength(values.note);
  const noteTooLong = noteBytes > NOTE_MAX_BYTES;

  // A one-off nudge, not a permanent hint: appears right after the intern
  // checks the box, then fades on its own — the disabled/urgentBlocked states
  // already explain themselves via the hint text below.
  function handleUrgentChange(checked: boolean) {
    update("urgent", checked);
    setShowUrgentTip(checked);
    if (checked) {
      window.setTimeout(() => setShowUrgentTip(false), 3500);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEdits((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSubmitError(null);

    if (dailyBlocked) {
      setErrors({ date: "כבר פרסמת תורנות בתאריך הזה" });
      return;
    }
    if (monthlyBlocked) {
      setErrors({ date: "פרסמת כבר 4 תורנויות החודש — זו המכסה" });
      return;
    }

    const parsed = schema.safeParse({
      displayName: values.displayName,
      phone: values.phone,
      email: values.email,
      date: values.date,
      department: values.department,
      internalUnit: values.internalUnit || null,
      note: values.note,
      urgent,
      willingToSwap: values.willingToSwap,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await createShift(user.uid, parsed.data);
      router.push("/?posted=1");
    } catch {
      // Every rule this form knows about is pre-checked live above, so
      // reaching the server and still being denied means something the
      // pre-check couldn't have caught (a genuine last-moment race, a
      // dropped connection) — no point guessing which.
      setSubmitError("הפרסום נכשל. יש לנסות שוב.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <TextField
          label="שם"
          value={values.displayName}
          onChange={(e) => update("displayName", e.target.value)}
          error={errors.displayName}
          autoComplete="off"
          placeholder="שם מלא"
        />
        <TextField
          label="טלפון"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          error={errors.phone}
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="text-start"
          autoComplete="tel"
          placeholder="050-1234567"
          hint="המספר שאליו ייפתח הוואטסאפ"
        />
        <TextField
          label="אימייל"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <DateField
          label="תאריך התורנות"
          value={values.date}
          onChange={(value) => update("date", value)}
          error={
            errors.date ||
            (dailyBlocked
              ? "כבר פרסמת תורנות בתאריך הזה"
              : monthlyBlocked
                ? "פרסמת כבר 4 תורנויות החודש — זו המכסה"
                : undefined)
          }
          min={dateKeyOf(range.min)}
          max={dateKeyOf(range.max)}
          hint={
            dailyBlocked || monthlyBlocked
              ? undefined
              : quotaLoading
                ? "בודק זמינות…"
                : now.getDate() >= 15
                  ? "ניתן לפרסם תורנויות עד סוף החודש הבא"
                  : "ניתן לפרסם תורנויות עד סוף החודש. מה-15 ייפתח גם החודש הבא"
          }
        />

        <SelectField
          label="איפה התורנות"
          value={values.department}
          onChange={(value) => {
            update("department", value);
            // Switching away from פנימית must drop the unit, or a stale
            // selection travels along and lands on the shift.
            if (value !== "pnimit") update("internalUnit", "");
          }}
          options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }))}
          placeholder="בחירת מחלקה"
          error={errors.department}
        />

        {showUnitPicker && (
          <SelectField
            label="איזו פנימית"
            value={values.internalUnit}
            onChange={(value) => update("internalUnit", value)}
            options={PNIMIT_UNITS.map((u) => ({ value: u.id, label: u.label }))}
            placeholder="בחירת פנימית"
            error={errors.internalUnit}
          />
        )}

        <TextAreaField
          label="משהו להוסיף"
          value={values.note}
          onChange={(value) => update("note", value)}
          error={errors.note || (noteTooLong ? "ההערה ארוכה מדי" : undefined)}
          placeholder="לא חובה"
          hint={
            <span className={noteWords > NOTE_MAX_WORDS ? "text-urgent" : ""}>
              {noteWords}/{NOTE_MAX_WORDS} מילים
            </span>
          }
        />

        <div className="relative">
          <div
            role="status"
            className={cn(
              "pointer-events-none absolute -top-9 start-4 z-10 rounded-card border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-md transition-all duration-200",
              showUrgentTip
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1",
            )}
          >
            <span className="font-bold">שים לב:</span> ניתן לסמן רק תורנות
            אחת בחודש כדחופה
          </div>
          <CheckboxField
            label="דחוף לי למסור"
            checked={urgent}
            disabled={urgentBlocked || !values.date}
            onChange={handleUrgentChange}
            hint={
              !values.date
                ? "יש לבחור תאריך תחילה"
                : urgentBlocked
                  ? "כבר סימנת תורנות דחופה לחודש הזה"
                  : undefined
            }
          />
        </div>

        <CheckboxField
          label="מוכן גם להחלפה"
          checked={values.willingToSwap}
          onChange={(checked) => update("willingToSwap", checked)}
          hint="פתוח גם להחליף תורנויות, לא רק למסור"
          tone="info"
        />
      </Card>

      {submitError && <ErrorBanner>{submitError}</ErrorBanner>}

      <Button
        type="submit"
        size="lg"
        disabled={
          submitting ||
          quotaLoading ||
          dailyBlocked ||
          monthlyBlocked ||
          noteWords > NOTE_MAX_WORDS ||
          noteTooLong
        }
      >
        {submitting && (
          <Spinner className="size-5 border-primary-fg/30 border-t-primary-fg" />
        )}
        פרסום התורנות
      </Button>
    </form>
  );
}
