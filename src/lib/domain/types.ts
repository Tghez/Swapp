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
  createdAt: Date | null;
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

/**
 * One intern's posting activity for one month — mirrors what `firestore.rules`
 * enforces on `quotas/{uid}__{monthKey}`. `dates` holds one key per date the
 * intern currently has a shift on; its size is the monthly count (PDR §6.2's
 * four-a-month cap needs no separate counter, since "at most one shift per
 * date" already makes the two equal).
 */
export interface Quota {
  uid: string;
  monthKey: MonthKey;
  dates: Readonly<Record<DateKey, true>>;
  urgentShiftId: string | null;
}
