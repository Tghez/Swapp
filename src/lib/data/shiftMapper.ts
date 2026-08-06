import { Timestamp, type DocumentData } from "firebase/firestore";
import { isDepartmentId, isPnimitUnitId } from "@/lib/domain/departments";
import type { Shift, ShiftTakenBy } from "@/lib/domain/types";

/**
 * Firestore document → `Shift`.
 *
 * Every field is coerced defensively. Documents are written by clients, and a
 * shift left over from an older version of the app should render as slightly
 * wrong rather than crash the calendar for everyone looking at that month.
 */
export function toShiftFromSnapshot(id: string, data: DocumentData): Shift {
  const takenBy = data.takenBy as Partial<ShiftTakenBy> | null | undefined;

  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    ownerName: String(data.ownerName ?? ""),
    ownerPhone: String(data.ownerPhone ?? ""),
    ownerEmail: String(data.ownerEmail ?? ""),
    date: String(data.date ?? ""),
    monthKey: String(data.monthKey ?? ""),
    department: isDepartmentId(data.department) ? data.department : "pnimit",
    internalUnit: isPnimitUnitId(data.internalUnit) ? data.internalUnit : null,
    note: typeof data.note === "string" && data.note ? data.note : null,
    urgent: data.urgent === true,
    status: data.status === "handedOff" ? "handedOff" : "open",
    takenBy:
      takenBy && takenBy.uid
        ? {
            uid: String(takenBy.uid),
            name: String(takenBy.name ?? ""),
            phone: String(takenBy.phone ?? ""),
          }
        : null,
    interestCount:
      typeof data.interestCount === "number" ? data.interestCount : 0,
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}
