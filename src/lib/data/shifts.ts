import {
  collection,
  doc,
  getDocs,
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
import type { HandoffInput, Interest, Shift } from "@/lib/domain/types";

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
 * the rules do not permit. The monthly counter instead increments a `count`
 * field the rules cap at 4 — deliberately not released when a shift is
 * deleted, so posting and cancelling repeatedly cannot be used to dodge
 * either cap.
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
    takenBy: null,
    interestCount: 0,
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
 * Any interests pointing at it go too — Firestore has no cascade, and leaving
 * them would show phantom entries in the owner's inbox until TTL caught up.
 * An urgent shift also releases its lock, so deleting a mistaken post does not
 * cost the intern their דחיפות for the month.
 */
export async function deleteShift(shift: Shift): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  batch.delete(doc(db, COLLECTIONS.shifts, shift.id));

  // Constrained by shiftOwnerId as well as shiftId, not because both are
  // needed to find the documents but because Firestore rejects any query it
  // cannot prove returns only readable documents. Interests are readable by
  // the taker or the shift owner, so the owner clause has to be in the query
  // itself — filtering on shiftId alone comes back permission-denied.
  const relatedInterests = await getDocs(
    query(
      collection(db, COLLECTIONS.interests),
      where("shiftOwnerId", "==", shift.ownerId),
      where("shiftId", "==", shift.id),
    ),
  );
  relatedInterests.forEach((snap) => batch.delete(snap.ref));

  if (shift.urgent) {
    batch.delete(
      doc(db, COLLECTIONS.urgencyLocks, urgencyLockId(shift.ownerId, shift.monthKey)),
    );
  }

  await batch.commit();
}

/**
 * The owner picks one of the interested interns. The chosen interest is
 * confirmed, the rest are declined so they stop showing as open in the inbox,
 * and the shift is marked handed off — atomically, so the board can never show
 * a shift as taken by someone whose interest was not recorded.
 */
export async function confirmHandoff(
  shift: Shift,
  chosen: Interest,
  allInterests: readonly Interest[],
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  batch.update(doc(db, COLLECTIONS.shifts, shift.id), {
    status: "handedOff",
    takenBy: {
      uid: chosen.takerId,
      name: chosen.takerName,
      phone: chosen.takerPhone,
    },
  });

  for (const candidate of allInterests) {
    if (candidate.shiftId !== shift.id) continue;
    batch.update(doc(db, COLLECTIONS.interests, candidate.id), {
      status: candidate.id === chosen.id ? "confirmed" : "declined",
    });
  }

  await batch.commit();
}

/** Puts a handed-off shift back on the board. */
export async function reopenShift(shift: Shift): Promise<void> {
  await updateDoc(doc(getDb(), COLLECTIONS.shifts, shift.id), {
    status: "open",
    takenBy: null,
  });
}

/**
 * The owner marks a shift as handed off without going through the
 * confirm-an-applicant flow — e.g. it was settled outside the app. Unlike
 * {@link deleteShift}, the shift stays in the calendar (struck through and
 * marked, see `ShiftChip`) instead of disappearing everywhere.
 */
export async function markShiftHandedOff(shift: Shift): Promise<void> {
  await updateDoc(doc(getDb(), COLLECTIONS.shifts, shift.id), {
    status: "handedOff",
    takenBy: null,
  });
}
