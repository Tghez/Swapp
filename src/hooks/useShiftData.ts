"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToMonthShifts, subscribeToMyShifts } from "@/lib/data/shifts";
import {
  subscribeToInterestInbox,
  subscribeToMyInterests,
} from "@/lib/data/interests";
import { getBrowsableMonths, type MonthKey } from "@/lib/date/monthWindow";
import type { Interest, Shift } from "@/lib/domain/types";

/**
 * A single clock for the whole session.
 *
 * Every month-window decision has to agree — the sidebar, the board's month
 * tabs and the handoff date bounds must not disagree because they each called
 * `new Date()` a few milliseconds apart across midnight on the 15th.
 */
export function useNow(): Date {
  return useMemo(() => new Date(), []);
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

/** Stable identities — a fresh [] each render would break downstream memos. */
const NO_SHIFTS: readonly Shift[] = [];
const NO_INTERESTS: readonly Interest[] = [];

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

/** Interns who have registered interest in the signed-in intern's shifts. */
export function useInterestInbox(
  uid: string | undefined,
): Subscription<readonly Interest[]> {
  const [entry, setEntry] = useState<Entry<readonly Interest[]> | null>(null);
  const key = uid ?? null;

  useEffect(() => {
    if (!key) return;
    return subscribeToInterestInbox(
      key,
      (interests) => setEntry({ key, data: interests, error: null }),
      (error) =>
        setEntry({ key, data: NO_INTERESTS, error: messageFor(error) }),
    );
  }, [key]);

  return derive(entry, key, NO_INTERESTS);
}

/** Shifts the signed-in intern has already registered interest in. */
export function useMyInterests(
  uid: string | undefined,
): Subscription<readonly Interest[]> {
  const [entry, setEntry] = useState<Entry<readonly Interest[]> | null>(null);
  const key = uid ?? null;

  useEffect(() => {
    if (!key) return;
    return subscribeToMyInterests(
      key,
      (interests) => setEntry({ key, data: interests, error: null }),
      (error) =>
        setEntry({ key, data: NO_INTERESTS, error: messageFor(error) }),
    );
  }, [key]);

  return derive(entry, key, NO_INTERESTS);
}
