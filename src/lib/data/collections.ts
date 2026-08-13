/**
 * Collection names and document-id conventions live here alone. Nothing above
 * `lib/data` should ever spell a collection name out.
 */

export const COLLECTIONS = {
  users: "users",
  shifts: "shifts",
  quotas: "quotas",
} as const;

/**
 * One doc per intern per month, tracking every posting limit at once: the
 * dates already claimed (at most one shift per date, and its key count is the
 * four-a-month cap) and the one urgent shift the month may have. Composite ids
 * are how uniqueness gets enforced without a server — Firestore's `create`
 * fails if the document already exists, and its map-diff rules pin how the
 * doc may change on `update` — turning "at most one/four of these" into
 * something the database enforces for free.
 */
export function quotaId(uid: string, monthKey: string): string {
  return `${uid}__${monthKey}`;
}
