import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, quotaId } from "./collections";
import type { MonthKey } from "@/lib/date/monthWindow";
import type { Quota } from "@/lib/domain/types";

function toQuota(uid: string, monthKey: MonthKey, data: DocumentData): Quota {
  const dates =
    data.dates && typeof data.dates === "object" ? (data.dates as Record<string, unknown>) : {};
  return {
    uid,
    monthKey,
    dates: Object.fromEntries(
      Object.entries(dates).filter(([, value]) => value === true).map(([key]) => [key, true]),
    ),
    urgentShiftId: typeof data.urgentShiftId === "string" ? data.urgentShiftId : null,
  };
}

/**
 * Live subscription to the signed-in intern's posting quota for one month —
 * the pre-check the handoff form blocks its submit button on. Emits `null`
 * until the intern's first shift of that month creates the doc, which means
 * every limit.
 */
export function subscribeToQuota(
  uid: string,
  monthKey: MonthKey,
  onChange: (quota: Quota | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.quotas, quotaId(uid, monthKey)),
    (snapshot) => {
      onChange(snapshot.exists() ? toQuota(uid, monthKey, snapshot.data()) : null);
    },
    (error) => onError?.(error),
  );
}
