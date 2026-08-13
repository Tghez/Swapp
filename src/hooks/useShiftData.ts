"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToMonthShifts, subscribeToMyShifts } from "@/lib/data/shifts";
import { subscribeToQuota } from "@/lib/data/quotas";
import { dateKeyOf, getBrowsableMonths, type MonthKey } from "@/lib/date/monthWindow";
import type { Quota, Shift } from "@/lib/domain/types";

/**
 * A single clock for the whole session.
 *
 * Every month-window decision has to agree — the sidebar, the board's month
 * tabs and the handoff date bounds must not disagree because they each called
 * `new Date()` a few milliseconds apart across midnight on the 15th.
 *
 * Ticks on a timer and on tab visibility, rather than being computed once at
 * mount: a PWA left open across midnight or across the 15th (when next month
 * opens up) would otherwise keep every month-window decision frozen at
 * whatever moment the tab first loaded. The dedupe against the current value
 * means most ticks are no-ops — nothing re-renders unless the day actually
 * changed.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      setNow((current) => {
        const next = new Date();
        return dateKeyOf(next) === dateKeyOf(current) ? current : next;
      });
    };
    const interval = setInterval(tick, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return now;
}

export function useBrowsableMonths(now: Date): MonthKey[] {
  return useMemo(() => getBrowsableMonths(now), [now]);
}

export interface Subscription<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * What a subscription has delivered, tagged with the query it answers.
 *
 * Tagging is what lets `loading` be derived rather than stored: a result whose
 * key no longer matches what the caller is asking for is simply stale, so
 * there is no need to synchronously reset state when the query changes.
 */
interface Entry<T> {
  key: string;
  data: T;
  error: string | null;
}

/** Stable identity — a fresh [] each render would break downstream memos. */
const NO_SHIFTS: readonly Shift[] = [];

function derive<T>(
  entry: Entry<T> | null,
  key: string | null,
  empty: T,
): Subscription<T> {
  if (key === null) return { data: empty, loading: false, error: null };
  if (!entry || entry.key !== key) {
    return { data: empty, loading: true, error: null };
  }
  return { data: entry.data, loading: false, error: entry.error };
}

const PERMISSION_HINT =
  "אין הרשאה לקרוא את הנתונים. ייתכן שכללי האבטחה טרם פורסמו.";

function messageFor(error: Error): string {
  return error.message.includes("permission")
    ? PERMISSION_HINT
    : "טעינת הנתונים נכשלה. יש לרענן את הדף.";
}

/** All shifts posted for one month — the board's data source. */
export function useMonthShifts(
  monthKey: MonthKey,
): Subscription<readonly Shift[]> {
  const [entry, setEntry] = useState<Entry<readonly Shift[]> | null>(null);

  useEffect(() => {
    return subscribeToMonthShifts(
      monthKey,
      (shifts) => setEntry({ key: monthKey, data: shifts, error: null }),
      (error) =>
        setEntry({ key: monthKey, data: NO_SHIFTS, error: messageFor(error) }),
    );
  }, [monthKey]);

  return derive(entry, monthKey, NO_SHIFTS);
}

/** The signed-in intern's own shifts, for the sidebar. */
export function useMyShifts(
  uid: string | undefined,
  months: readonly MonthKey[],
): Subscription<readonly Shift[]> {
  const [entry, setEntry] = useState<Entry<readonly Shift[]> | null>(null);

  // Depend on the joined string rather than the array, whose identity changes
  // every render and would tear the subscription down and back up each time.
  const monthsKey = months.join(",");
  const key = uid ? `${uid}|${monthsKey}` : null;

  useEffect(() => {
    if (!uid || key === null) return;
    return subscribeToMyShifts(
      uid,
      monthsKey.split(","),
      (shifts) => setEntry({ key, data: shifts, error: null }),
      (error) => setEntry({ key, data: NO_SHIFTS, error: messageFor(error) }),
    );
  }, [uid, monthsKey, key]);

  return derive(entry, key, NO_SHIFTS);
}

/**
 * The signed-in intern's posting quota for one month — the live source of
 * truth the handoff form blocks its submit button on, instead of deriving
 * the same limits by scanning `myShifts` (which depends on a month window
 * that can go stale in a long-lived tab). `monthKey` is `null` until a date
 * is picked, so there is nothing to check yet.
 */
export function useQuota(
  uid: string | undefined,
  monthKey: MonthKey | null,
): Subscription<Quota | null> {
  const [entry, setEntry] = useState<Entry<Quota | null> | null>(null);

  const key = uid && monthKey ? `${uid}|${monthKey}` : null;

  useEffect(() => {
    if (!uid || !monthKey || key === null) return;
    return subscribeToQuota(
      uid,
      monthKey,
      (quota) => setEntry({ key, data: quota, error: null }),
      (error) => setEntry({ key, data: null, error: messageFor(error) }),
    );
  }, [uid, monthKey, key]);

  return derive(entry, key, null);
}
