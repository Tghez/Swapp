import {
  collection,
  doc,
  increment,
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
import { COLLECTIONS, dailyLockId, handoffCountId, urgencyLockId } from "./collections";
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
 * shift itself, the profile upsert that makes the form self-filling next time,
 * the one-shift-per-date lock, the four-a-month handoff counter, and — when
 * דחיפות is ticked — the once-per-month urgency lock.
 *
 * The date lock works exactly like the urgency lock: its id is derived from
 * uid + the shift's own date (not the day it is posted), so a second shift
 * dated the same day is a `create` on a document that already exists, which
 * the rules do not permit — and unlike the monthly counter, this one is
 * never released, so posting and cancelling repeatedly cannot be used to
 * free up an already-claimed date. The monthly counter instead increments a
 * `count` field the rules cap at 4; {@link deleteShift} decrements it again,
 * so the cap tracks shifts currently on the books rather than shifts ever
 * posted.
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

  batch.set(doc(db, COLLECTIONS.dailyLocks, dailyLockId(uid, input.date)), {
    uid,
    date: input.date,
    monthKey,
    shiftId: shiftRef.id,
    createdAt: serverTimestamp(),
    expireAt,
  });

  batch.set(
    doc(db, COLLECTIONS.handoffCounts, handoffCountId(uid, monthKey)),
    {
      uid,
      monthKey,
      count: increment(1),
      expireAt,
    },
    { merge: true },
  );

  if (input.urgent) {
    // Keyed by the month the shift falls in, not the month it was posted in.
    // Posting on 20 August for a shift on 5 September should spend September's
    // urgency, not August's — and it keeps the lock's id derivable from the
    // shift alone, which is what lets deleteShift release it.
    batch.set(doc(db, COLLECTIONS.urgencyLocks, urgencyLockId(uid, monthKey)), {
      uid,
      monthKey,
      shiftId: shiftRef.id,
      createdAt: serverTimestamp(),
      expireAt,
    });
  }

  await batch.commit();
  return shiftRef.id;
}

/**
 * Deletes a shift, which in this app means "I handed it off" (PDR §6.1).
 *
 * An urgent shift also releases its lock, so deleting a mistaken post does not
 * cost the intern their דחיפות for the month. The monthly handoff counter is
 * decremented too, so the four-a-month cap tracks shifts still on the books
 * rather than shifts ever posted — a shift marked handed off via
 * {@link markShiftHandedOff} stays counted, since only deletion frees the
 * slot.
 */
export async function deleteShift(shift: Shift): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  batch.delete(doc(db, COLLECTIONS.shifts, shift.id));

  batch.update(
    doc(db, COLLECTIONS.handoffCounts, handoffCountId(shift.ownerId, shift.monthKey)),
    { count: increment(-1) },
  );

  if (shift.urgent) {
    batch.delete(
      doc(db, COLLECTIONS.urgencyLocks, urgencyLockId(shift.ownerId, shift.monthKey)),
    );
  }

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
