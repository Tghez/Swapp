"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { ErrorBanner, Spinner } from "@/components/ui/Feedback";
import { DEPARTMENTS, PNIMIT_UNITS } from "@/lib/domain/departments";
import {
  countWords,
  createHandoffSchema,
  NOTE_MAX_WORDS,
} from "@/lib/domain/schemas";
import {
  dateKeyOf,
  getSelectableRange,
  monthKeyOf,
  parseDateKey,
} from "@/lib/date/monthWindow";
import { createShift } from "@/lib/data/shifts";
import { useMyShifts, useBrowsableMonths, useNow } from "@/hooks/useShiftData";

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
  const months = useBrowsableMonths(now);
  const { data: myShifts } = useMyShifts(user?.uid, months);

  const [edits, setEdits] = useState<Partial<FormState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showUrgentTip, setShowUrgentTip] = useState(false);

  const range = useMemo(() => getSelectableRange(now), [now]);
  const schema = useMemo(() => createHandoffSchema(now), [now]);

  /**
   * Autofill (PDR §4): the saved profile wins, since that is what the intern
   * typed themselves. On the very first visit there is no profile yet, so fall
   * back to what Google supplied — which covers name and email but never a
   * phone number, the one field they must always enter once.
   *
   * These are defaults rather than initial state, and what the intern types is
   * held separately as `edits`. That way the fields fill in the moment the
   * profile arrives without an effect copying it into state, and without
   * clobbering anything already typed while it was loading.
   */
  const defaults = useMemo<FormState>(
    () => ({
      ...BLANK,
      displayName: profile?.displayName || user?.displayName || "",
      phone: profile?.phone || "",
      email: profile?.email || user?.email || "",
    }),
    [profile, user],
  );

  const values: FormState = { ...defaults, ...edits };

  const selectedDepartment = DEPARTMENTS.find((d) => d.id === values.department);
  const showUnitPicker = selectedDepartment?.hasUnits ?? false;

  /**
   * דחיפות is limited to one shift per month. The month that counts is the one
   * the shift falls in, so the checkbox only locks once a date is picked.
   */
  const targetMonthKey = values.date
    ? monthKeyOf(parseDateKey(values.date))
    : null;
  const urgencyTaken = targetMonthKey
    ? myShifts.some((s) => s.urgent && s.monthKey === targetMonthKey)
    : false;

  /**
   * At most one shift per date and four a month, mirrored client-side from
   * `myShifts` for an honest hint — the server (via dailyLocks and
   * handoffCounts) is what actually enforces it, and does not forget a slot
   * just because the shift behind it was later deleted, so these can
   * under-count after a cancel. That is fine: the goal here is to keep the
   * interface honest, not to be the source of truth.
   *
   * Suppressed while `submitting`: the moment a post succeeds, the realtime
   * `myShifts` subscription picks up the shift just created — before
   * `router.push` has navigated away — which would otherwise flash this
   * error for the shift the intern is in the middle of successfully posting.
   * `submitting` only clears on failure, so a genuine conflict still shows
   * before the next attempt.
   */
  const dailyLimitReached =
    !submitting && values.date
      ? myShifts.some((s) => s.date === values.date)
      : false;
  const monthlyLimitReached =
    !submitting && targetMonthKey
      ? myShifts.filter((s) => s.monthKey === targetMonthKey).length >= 4
      : false;

  // Derived, not corrected after the fact: ticking the box and then moving to
  // a date whose month is already spent must not submit an urgent flag the
  // server would reject.
  const urgent = values.urgent && !urgencyTaken;

  const noteWords = countWords(values.note);

  // A one-off nudge, not a permanent hint: appears right after the intern
  // checks the box, then fades on its own — the disabled/urgencyTaken states
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

    if (dailyLimitReached) {
      setErrors({ date: "כבר פרסמת תורנות בתאריך הזה" });
      return;
    }
    if (monthlyLimitReached) {
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
    } catch (caught) {
      // A denied write here means one of the server-enforced limits kicked
      // in: the urgency lock, the daily lock, or the monthly handoff cap.
      // The client-side hints above cover the common cases, so this is the
      // fallback for whatever they missed (e.g. a shift deleted and quota
      // still spent, or state that changed in another tab).
      const message =
        caught instanceof Error && caught.message.includes("permission")
          ? "לא ניתן לפרסם. ייתכן שהגעת למכסה החודשית, כבר פרסמת תורנות היום, או שכבר סימנת דחיפות לחודש הזה."
          : "הפרסום נכשל. יש לנסות שוב.";
      setSubmitError(message);
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
          autoComplete="name"
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
        <TextField
          label="תאריך התורנות"
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
          error={
            errors.date ||
            (dailyLimitReached
              ? "כבר פרסמת תורנות בתאריך הזה"
              : monthlyLimitReached
                ? "פרסמת כבר 4 תורנויות החודש — זו המכסה"
                : undefined)
          }
          type="date"
          min={dateKeyOf(range.min)}
          max={dateKeyOf(range.max)}
          hint={
            dailyLimitReached || monthlyLimitReached
              ? undefined
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
          error={errors.note}
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
            ניתן לסמן רק תורנות אחת בחודש כדחופה
          </div>
          <CheckboxField
            label="דחוף לי למסור"
            checked={urgent}
            disabled={urgencyTaken || !values.date}
            onChange={handleUrgentChange}
            hint={
              !values.date
                ? "יש לבחור תאריך תחילה"
                : urgencyTaken
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
        />
      </Card>

      {submitError && <ErrorBanner>{submitError}</ErrorBanner>}

      <Button
        type="submit"
        size="lg"
        disabled={submitting || dailyLimitReached || monthlyLimitReached}
      >
        {submitting && (
          <Spinner className="size-5 border-primary-fg/30 border-t-primary-fg" />
        )}
        פרסום התורנות
      </Button>
    </form>
  );
}
