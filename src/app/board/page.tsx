"use client";

import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { DayDetailModal } from "@/components/calendar/DayDetailModal";
import { Legend } from "@/components/calendar/ShiftChip";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { ErrorBanner, Spinner } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import {
  useBrowsableMonths,
  useMonthShifts,
  useMyInterests,
  useNow,
} from "@/hooks/useShiftData";
import {
  useAuth,
  useDisplayName,
} from "@/components/providers/AuthProvider";
import { DEPARTMENTS, PNIMIT_UNITS } from "@/lib/domain/departments";
import {
  dateKeyOf,
  formatMonthLabel,
  parseMonthKey,
} from "@/lib/date/monthWindow";
import { registerInterest } from "@/lib/data/interests";
import type { Shift } from "@/lib/domain/types";

export default function BoardPage() {
  return (
    <RequireAuth>
      <AppShell showBack title="לקיחת תורנות">
        <BoardView />
      </AppShell>
    </RequireAuth>
  );
}

function BoardView() {
  const { user, profile } = useAuth();
  const takerName = useDisplayName();
  const now = useNow();
  const months = useBrowsableMonths(now);

  const [monthKey, setMonthKey] = useState(months[0]);
  const [department, setDepartment] = useState("");
  const [unit, setUnit] = useState("");
  const [showHandedOff, setShowHandedOff] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: shifts, loading, error } = useMonthShifts(monthKey);
  const { data: myInterests } = useMyInterests(user?.uid);

  const interestedShiftIds = useMemo(
    () => new Set(myInterests.map((interest) => interest.shiftId)),
    [myInterests],
  );

  /**
   * Filtering happens here rather than in the Firestore query — a month holds
   * tens of documents, so the round trip and extra composite index a
   * server-side filter would cost buy nothing.
   */
  const visibleShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // Someone else's handed-off shift is stale noise while browsing for
      // one to take, so it stays behind the checkbox. Your own stays visible
      // regardless — that's the calendar record of "I handed this off".
      if (
        !showHandedOff &&
        shift.status === "handedOff" &&
        shift.ownerId !== user?.uid
      ) {
        return false;
      }
      if (department && shift.department !== department) return false;
      if (department === "pnimit" && unit && shift.internalUnit !== unit) {
        return false;
      }
      return true;
    });
  }, [shifts, department, unit, showHandedOff, user?.uid]);

  const selectedDayShifts = useMemo(() => {
    if (!selectedDay) return [];
    const key = dateKeyOf(selectedDay);
    return visibleShifts.filter((shift) => shift.date === key);
  }, [selectedDay, visibleShifts]);

  const monthDate = useMemo(() => parseMonthKey(monthKey), [monthKey]);

  async function handleRegisterInterest(shift: Shift) {
    if (!user) return;
    await registerInterest({
      shift,
      takerId: user.uid,
      takerName: takerName || "סטאז'ר",
      takerPhone: profile?.phone ?? "",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-text">לקחת תורנות</h1>
        <p className="mt-1 text-sm text-muted">
          בוחרים יום כדי לראות את כל התורנויות שבו, ופונים ישירות למי שפרסם.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        {months.length > 1 && (
          <div
            role="tablist"
            aria-label="בחירת חודש"
            className="flex gap-2 self-start rounded-pill bg-bg p-1"
          >
            {months.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={key === monthKey}
                onClick={() => setMonthKey(key)}
                className={cn(
                  "rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors",
                  key === monthKey
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-text",
                )}
              >
                {formatMonthLabel(parseMonthKey(key))}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="מחלקה"
            value={department}
            onChange={(value) => {
              setDepartment(value);
              // The unit filter is only meaningful for פנימית; leaving a
              // stale value behind would silently filter everything out.
              if (value !== "pnimit") setUnit("");
            }}
            options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }))}
            placeholder="כל המחלקות"
          />
          {department === "pnimit" && (
            <SelectField
              label="איזו פנימית"
              value={unit}
              onChange={setUnit}
              options={PNIMIT_UNITS.map((u) => ({
                value: u.id,
                label: u.label,
              }))}
              placeholder="כל הפנימיות"
            />
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showHandedOff}
            onChange={(event) => setShowHandedOff(event.target.checked)}
            className="size-4 accent-[var(--color-secondary)]"
          />
          הצגת תורנויות שכבר נמסרו
        </label>

        <Legend />
      </Card>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {visibleShifts.length === 0
              ? "אין תורנויות שתואמות לסינון"
              : `${visibleShifts.length} תורנויות ב${formatMonthLabel(monthDate)}`}
          </p>
          <MonthGrid
            monthDate={monthDate}
            shifts={visibleShifts}
            onSelectDay={setSelectedDay}
          />
        </>
      )}

      <DayDetailModal
        date={selectedDay}
        shifts={selectedDayShifts}
        currentUid={user?.uid ?? ""}
        interestedShiftIds={interestedShiftIds}
        onRegisterInterest={handleRegisterInterest}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
