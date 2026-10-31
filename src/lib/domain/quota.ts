import type { DateKey } from "@/lib/date/monthWindow";
import type { Quota } from "./types";

export interface QuotaEvaluation {
  /** The intern already has a shift on this exact date. */
  dailyBlocked: boolean;
  /** The intern already has an urgent shift posted this month. */
  urgentBlocked: boolean;
}

/**
 * Pure mirror of what `firestore.rules` enforces on `quotas/{uid}__{monthKey}`,
 * so the form can block a submit before it ever reaches the server. `quota` is
 * `null` when the intern has posted nothing this month yet — every check is
 * then trivially unblocked.
 */
export function evaluateQuota(quota: Quota | null, date: DateKey): QuotaEvaluation {
  return {
    dailyBlocked: quota != null && quota.dates[date] === true,
    urgentBlocked: quota != null && quota.urgentShiftId != null,
  };
}
