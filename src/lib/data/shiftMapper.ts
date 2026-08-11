import { Timestamp, type DocumentData } from "firebase/firestore";
import { isDepartmentId, isPnimitUnitId } from "@/lib/domain/departments";
import type { Shift } from "@/lib/domain/types";

/**
 * Firestore document → `Shift`.
 *
 * Every field is coerced defensively. Documents are written by clients, and a
 * shift left over from an older version of the app should render as slightly
 * wrong rather than crash the calendar for everyone looking at that month.
 */
export function toShiftFromSnapshot(id: string, data: DocumentData): Shift {
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
    willingToSwap: data.willingToSwap === true,
    status: data.status === "handedOff" ? "handedOff" : "open",
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}
