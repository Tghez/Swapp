/**
 * Collection names and document-id conventions live here alone. Nothing above
 * `lib/data` should ever spell a collection name out.
 */

export const COLLECTIONS = {
  users: "users",
  shifts: "shifts",
  interests: "interests",
  urgencyLocks: "urgencyLocks",
  dailyLocks: "dailyLocks",
  handoffCounts: "handoffCounts",
} as const;

/**
 * Composite ids are how uniqueness gets enforced without a server. Firestore
 * `create` fails if the document already exists, so a deterministic id turns
 * "at most one of these" into a rule the database enforces for free.
 */

/** One interest per intern per shift. */
export function interestId(shiftId: string, takerId: string): string {
  return `${shiftId}__${takerId}`;
}

/** One דחיפות flag per intern per month (PDR §6.2). */
export function urgencyLockId(uid: string, monthKey: string): string {
  return `${uid}__${monthKey}`;
}

/** At most one shift per intern per date — keyed by the shift's own date, not the day it's posted. */
export function dailyLockId(uid: string, date: string): string {
  return `${uid}__${date}`;
}

/** Running total of shifts posted per intern per month, capped at 4. */
export function handoffCountId(uid: string, monthKey: string): string {
  return `${uid}__${monthKey}`;
}
