import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "./collections";
import type { UserProfile } from "@/lib/domain/types";

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toProfile(uid: string, data: DocumentData): UserProfile {
  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    email: typeof data.email === "string" ? data.email : "",
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * Live subscription to the signed-in intern's profile. Emits null until the
 * first handover submission creates it (PDR §4).
 */
export function subscribeToProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.users, uid),
    (snapshot) => {
      onChange(snapshot.exists() ? toProfile(uid, snapshot.data()) : null);
    },
    (error) => onError?.(error),
  );
}

export interface ProfileWrite {
  displayName: string;
  phone: string;
  email: string;
}

/** Fields written for a profile upsert, shared with the batched handoff write. */
export function buildProfilePayload(profile: ProfileWrite) {
  return { ...profile, updatedAt: serverTimestamp() };
}

/**
 * Upserts the profile, which is what makes the handing-off form self-filling
 * from the second submission onwards (PDR §4).
 *
 * Merged rather than overwritten so a future field added elsewhere is not
 * wiped by a form that does not know about it.
 */
export async function upsertProfile(
  uid: string,
  profile: ProfileWrite,
): Promise<void> {
  await setDoc(doc(getDb(), COLLECTIONS.users, uid), buildProfilePayload(profile), {
    merge: true,
  });
}
