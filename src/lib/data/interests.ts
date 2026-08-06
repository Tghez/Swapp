import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, interestId } from "./collections";
import { toShiftFromSnapshot } from "./shiftMapper";
import { expireAtForMonthKey } from "@/lib/date/monthWindow";
import type { Interest, InterestStatus, Shift } from "@/lib/domain/types";

function toInterest(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Interest {
  const data = snapshot.data();
  const status = data.status as InterestStatus | undefined;
  return {
    id: snapshot.id,
    shiftId: String(data.shiftId ?? ""),
    shiftOwnerId: String(data.shiftOwnerId ?? ""),
    takerId: String(data.takerId ?? ""),
    takerName: String(data.takerName ?? ""),
    takerPhone: String(data.takerPhone ?? ""),
    status:
      status === "confirmed" || status === "declined" ? status : "pending",
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

/** Everyone who has registered interest in the signed-in intern's shifts. */
export function subscribeToInterestInbox(
  ownerUid: string,
  onChange: (interests: Interest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.interests),
    where("shiftOwnerId", "==", ownerUid),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(toInterest)),
    (error) => onError?.(error),
  );
}

/** The interests the signed-in intern has registered, to mark shifts as "כבר פנית". */
export function subscribeToMyInterests(
  takerUid: string,
  onChange: (interests: Interest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(getDb(), COLLECTIONS.interests),
    where("takerId", "==", takerUid),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(toInterest)),
    (error) => onError?.(error),
  );
}

export interface RegisterInterestInput {
  shift: Shift;
  takerId: string;
  takerName: string;
  takerPhone: string;
}

export class AlreadyInterestedError extends Error {
  constructor() {
    super("כבר סימנת עניין בתורנות הזו");
    this.name = "AlreadyInterestedError";
  }
}

/**
 * Registers interest in someone else's shift.
 *
 * Interests deliberately do not block one another — several interns may
 * register on the same shift and the owner chooses. That removes the whole
 * class of stuck states a first-come lock would create, so there is no claim
 * expiry to manage.
 *
 * Run as a transaction rather than a plain write because `interestCount` is
 * denormalised onto the shift, and the security rule requires a non-owner to
 * move it by exactly one. Reading and writing in the same transaction keeps
 * that true under concurrent registrations instead of losing an update.
 */
export async function registerInterest({
  shift,
  takerId,
  takerName,
  takerPhone,
}: RegisterInterestInput): Promise<void> {
  const db = getDb();
  const shiftRef = doc(db, COLLECTIONS.shifts, shift.id);
  const interestRef = doc(
    db,
    COLLECTIONS.interests,
    interestId(shift.id, takerId),
  );

  await runTransaction(db, async (transaction) => {
    const [shiftSnap, interestSnap] = await Promise.all([
      transaction.get(shiftRef),
      transaction.get(interestRef),
    ]);

    if (!shiftSnap.exists()) {
      throw new Error("התורנות כבר לא זמינה");
    }
    if (interestSnap.exists()) {
      throw new AlreadyInterestedError();
    }

    const current = shiftSnap.data();
    const currentCount =
      typeof current.interestCount === "number" ? current.interestCount : 0;

    transaction.set(interestRef, {
      shiftId: shift.id,
      shiftOwnerId: shift.ownerId,
      takerId,
      takerName,
      takerPhone,
      status: "pending",
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromDate(expireAtForMonthKey(shift.monthKey)),
    });

    transaction.update(shiftRef, { interestCount: currentCount + 1 });
  });
}

/** Owner rejects a single applicant without handing the shift to anyone. */
export async function declineInterest(interest: Interest): Promise<void> {
  const db = getDb();
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, COLLECTIONS.interests, interest.id);
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    transaction.update(ref, { status: "declined" });
  });
}

/** One-off read, used when the inbox needs a shift it has not subscribed to. */
export async function fetchShiftById(shiftId: string): Promise<Shift | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.shifts, shiftId));
  return snap.exists() ? toShiftFromSnapshot(snap.id, snap.data()) : null;
}
