import type { DepartmentId, PnimitUnitId } from "./departments";
import type { DateKey, MonthKey } from "@/lib/date/monthWindow";

/**
 * Application-facing shapes. The data layer converts Firestore Timestamps to
 * Dates at the boundary so nothing above `lib/data` ever imports from
 * `firebase/firestore`.
 */

export interface UserProfile {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  updatedAt: Date | null;
}

export type ShiftStatus = "open" | "handedOff";

export interface ShiftTakenBy {
  uid: string;
  name: string;
  phone: string;
}

export interface Shift {
  id: string;
  ownerId: string;
  /**
   * Owner contact details are denormalised onto the shift on purpose: the board
   * renders them and builds the wa.me link for every visible shift, and reading
   * users/{uid} per shift would mean an N+1 read plus security rules exposing
   * every intern's profile to everyone.
   */
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  date: DateKey;
  monthKey: MonthKey;
  department: DepartmentId;
  internalUnit: PnimitUnitId | null;
  note: string | null;
  urgent: boolean;
  willingToSwap: boolean;
  status: ShiftStatus;
  takenBy: ShiftTakenBy | null;
  interestCount: number;
  createdAt: Date | null;
}

export type InterestStatus = "pending" | "confirmed" | "declined";

/**
 * An intern registering interest in someone else's shift. Interests never block
 * one another — several people may register on the same shift and the owner
 * picks one, so there is no stuck "claimed but unconfirmed" state to expire.
 */
export interface Interest {
  id: string;
  shiftId: string;
  shiftOwnerId: string;
  takerId: string;
  takerName: string;
  takerPhone: string;
  status: InterestStatus;
  createdAt: Date | null;
}

/** An interest joined with the shift it refers to, for the owner's inbox. */
export interface InterestWithShift {
  interest: Interest;
  shift: Shift | null;
}

export interface HandoffInput {
  displayName: string;
  phone: string;
  email: string;
  date: DateKey;
  department: DepartmentId;
  internalUnit: PnimitUnitId | null;
  note: string | null;
  urgent: boolean;
  willingToSwap: boolean;
}
