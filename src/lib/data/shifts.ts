import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, quotaId } from "./collections";
import { buildProfilePayload } from "./users";
import { toShiftFromSnapshot } from "./shiftMapper";
import {
  expireAtForMonthKey,
  monthKeyOf,
  parseDateKey,
  type MonthKey,
} from "@/lib/date/monthWindow";
import type { HandoffInput, Shift } from "@/lib/domain/types";

function toShift(snapshot: QueryDocumentSnapshot<DocumentData>): Shift {
  return toShiftFromSnapshot(snapshot.id, snapshot.data());
}

/**
 * All shifts posted for a given month.
 *
 * Department and status filtering happen client-side rather than in the query:
 * a month holds tens of documents, and pushing the filters into Firestore would
 * buy a second composite index and a re-subscribe on every filter change for no
 * measurable gain.
 */
export function subscribeToMonthShifts(
  monthKey: MonthKey,
  onChange: (shifts: Shift[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.shifts),
    where("monthKey", "==", monthKey),
    orderBy("date"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(toShift)),
    (error) => onError?.(error),
  );
}

/**
 * The signed-in intern's own shifts, for the landing-page sidebar.
 *
 * Filtered to the still-relevant months in memory. Firestore TTL is best-effort
 * and can trail expiry by up to a day, so a document that should be gone may
 * still be there — this filter is what guarantees it is never rendered.
 */
export function subscribeToMyShifts(
  uid: string,
  visibleMonths: readonly MonthKey[],
  onChange: (shifts: Shift[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.shifts),
    where("ownerId", "==", uid),
    orderBy("date"),
  );
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs.map(toShift).filter((s) => visibleMonths.includes(s.monthKey)),
      ),
    (error) => onError?.(error),
  );
}

/**
 * Posts a shift.
 *
 * Written as one batch so all of its effects land together or not at all: the
 * shift itself, the profile upsert that makes the form self-filling next
 * time, and one write to the intern's `quotas/{uid}__{monthKey}` doc that
 * covers all three posting limits at once (PDR §6.2): it claims this date in
 * the doc's `dates` map (a repeat date is a no-op change the rules reject,
 * enforcing "at most one shift per date"), whose key count the rules cap at 4
 * (enforcing the monthly limit — no separate counter needed, since one shift
 * always claims exactly one date), and — when דחיפות is ticked — claims
 * `urgentShiftId`, which the rules only allow to move from null to a value.
 *
 * The `set(..., {merge:true})` call works whether this is the intern's first
 * shift of the month (Firestore creates the doc fresh) or a later one
 * (merges just the touched paths) — the rules distinguish create from update
 * server-side purely from whether the doc existed before, not which client
 * call produced the write. `monthKey` is the shift's own, not the month it
 * was posted in: posting on 20 August for a shift on 5 September spends
 * September's quota, not August's, and keeps the quota doc derivable from the
 * shift alone, which is what lets {@link deleteShift} release it.
 */
export async function createShift(
  uid: string,
  input: HandoffInput,
): Promise<string> {
  const db = getDb();
  const batch = writeBatch(db);

  const monthKey = monthKeyOf(parseDateKey(input.date));
  const expireAt = Timestamp.fromDate(expireAtForMonthKey(monthKey));

  const shiftRef = doc(collection(db, COLLECTIONS.shifts));
  batch.set(shiftRef, {
    ownerId: uid,
    ownerName: input.displayName,
    ownerPhone: input.phone,
    ownerEmail: input.email,
    date: input.date,
    monthKey,
    department: input.department,
    internalUnit: input.internalUnit,
    note: input.note,
    urgent: input.urgent,
    willingToSwap: input.willingToSwap,
    status: "open",
    createdAt: serverTimestamp(),
    expireAt,
  });

  batch.set(
    doc(db, COLLECTIONS.users, uid),
    buildProfilePayload({
      displayName: input.displayName,
      phone: input.phone,
      email: input.email,
    }),
    { merge: true },
  );

  batch.set(
    doc(db, COLLECTIONS.quotas, quotaId(uid, monthKey)),
    {
      uid,
      monthKey,
      expireAt,
      // A plain nested object with {merge:true} deep-merges into the
      // existing `dates` map (unlike a dotted string key, which `set` — as
      // opposed to `update` — treats as one literal field name).
      dates: { [input.date]: true },
      ...(input.urgent ? { urgentShiftId: shiftRef.id } : {}),
    },
    { merge: true },
  );

  await batch.commit();
  return shiftRef.id;
}

/**
 * Deletes a shift, which in this app means "I handed it off" (PDR §6.1).
 *
 * Releases this date from the intern's quota doc (so the date and, if this
 * was the month's fourth shift, a monthly slot are free again if the intern
 * regrets the delete and wants to re-post) and, for an urgent shift, clears
 * `urgentShiftId` too, so deleting a mistaken post does not cost the intern
 * their דחיפות for the month. A shift marked handed off via
 * {@link markShiftHandedOff} stays on the books (and counted) instead, since
 * only deletion frees the quota.
 */
export async function deleteShift(shift: Shift): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  batch.delete(doc(db, COLLECTIONS.shifts, shift.id));

  batch.update(doc(db, COLLECTIONS.quotas, quotaId(shift.ownerId, shift.monthKey)), {
    [`dates.${shift.date}`]: deleteField(),
    ...(shift.urgent ? { urgentShiftId: null } : {}),
  });

  await batch.commit();
}

/** Puts a handed-off shift back on the board. */
export async function reopenShift(shift: Shift): Promise<void> {
  await updateDoc(doc(getDb(), COLLECTIONS.shifts, shift.id), {
    status: "open",
  });
}

/**
 * The owner marks a shift as handed off, settled outside the app (WhatsApp).
 * Unlike {@link deleteShift}, the shift stays in the calendar (struck through
 * and marked, see `ShiftChip`) instead of disappearing everywhere.
 */
export async function markShiftHandedOff(shift: Shift): Promise<void> {
  await updateDoc(doc(getDb(), COLLECTIONS.shifts, shift.id), {
    status: "handedOff",
  });
}
