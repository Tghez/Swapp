/**
 * The מחלקות an on-call shift can belong to.
 *
 * IDs are stable ASCII keys and are what gets written to Firestore — labels are
 * display-only, so renaming a department later never orphans existing shifts.
 *
 * Only the four top-level departments carry a colour. Giving each פנימית unit
 * its own colour would mean fourteen hues competing on one calendar, which is
 * unreadable; the unit shows as text on the chip instead.
 *
 * Tailwind class strings are written out in full rather than composed at
 * runtime, because the v4 scanner only picks up literal class names.
 */

export const DEPARTMENT_IDS = [
  "pnimit",
  "miyun_klali",
  "miyun_yeladim",
  "kirurgia",
] as const;

export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

export interface Department {
  id: DepartmentId;
  label: string;
  /**
   * Short form for the calendar chip, where a full label plus unit would
   * truncate to something indistinguishable from a sibling department (e.g.
   * "מיון כללי" and "מיון ילדים" both cut down to "מיון ..."). Full
   * elsewhere — sidebar, day detail, WhatsApp text — always use `label` via
   * `formatLocation`.
   */
  shortLabel: string;
  /** Whether this department requires an additional unit selection. */
  hasUnits: boolean;
  /** Chip background + border, used on calendar and in day detail. */
  chipClass: string;
  /** Solid swatch, used for the legend dot. */
  dotClass: string;
}

export const DEPARTMENTS: readonly Department[] = [
  {
    id: "pnimit",
    label: "פנימית",
    shortLabel: "פנימית",
    hasUnits: true,
    chipClass: "bg-dept-pnimit-soft border-dept-pnimit",
    dotClass: "bg-dept-pnimit",
  },
  {
    id: "miyun_klali",
    label: "מיון כללי",
    shortLabel: "מ. כללי",
    hasUnits: false,
    chipClass: "bg-dept-miyun-klali-soft border-dept-miyun-klali",
    dotClass: "bg-dept-miyun-klali",
  },
  {
    id: "miyun_yeladim",
    label: "מיון ילדים",
    shortLabel: "מ. ילדים",
    hasUnits: false,
    chipClass: "bg-dept-miyun-yeladim-soft border-dept-miyun-yeladim",
    dotClass: "bg-dept-miyun-yeladim",
  },
  {
    id: "kirurgia",
    label: "כירורגיה",
    shortLabel: "כירורגיה",
    hasUnits: false,
    chipClass: "bg-dept-kirurgia-soft border-dept-kirurgia",
    dotClass: "bg-dept-kirurgia",
  },
] as const;

/**
 * פנימית units as supplied by the hospital. Note there is no ז׳ — that is
 * intentional, not an omission.
 */
export const PNIMIT_UNIT_IDS = [
  "alef",
  "bet",
  "gimel",
  "dalet",
  "hey",
  "vav",
  "het",
  "tet",
  "yod",
  "geriatric",
] as const;

export type PnimitUnitId = (typeof PNIMIT_UNIT_IDS)[number];

export const PNIMIT_UNITS: readonly { id: PnimitUnitId; label: string }[] = [
  { id: "alef", label: "א׳" },
  { id: "bet", label: "ב׳" },
  { id: "gimel", label: "ג׳" },
  { id: "dalet", label: "ד׳" },
  { id: "hey", label: "ה׳" },
  { id: "vav", label: "ו׳" },
  { id: "het", label: "ח׳" },
  { id: "tet", label: "ט׳" },
  { id: "yod", label: "י׳" },
  { id: "geriatric", label: "גריאטרית" },
] as const;

const DEPARTMENT_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));
const PNIMIT_UNIT_BY_ID = new Map(PNIMIT_UNITS.map((u) => [u.id, u]));

export function getDepartment(id: DepartmentId): Department {
  const department = DEPARTMENT_BY_ID.get(id);
  if (!department) throw new Error(`Unknown department: ${id}`);
  return department;
}

export function isDepartmentId(value: unknown): value is DepartmentId {
  return typeof value === "string" && DEPARTMENT_BY_ID.has(value as DepartmentId);
}

export function isPnimitUnitId(value: unknown): value is PnimitUnitId {
  return typeof value === "string" && PNIMIT_UNIT_BY_ID.has(value as PnimitUnitId);
}

/**
 * Full human-readable location, e.g. "פנימית ג׳" or "מיון ילדים".
 * This is what appears on chips, in the day view, and in the WhatsApp message.
 */
export function formatLocation(
  departmentId: DepartmentId,
  unitId: PnimitUnitId | null,
): string {
  const department = getDepartment(departmentId);
  if (!department.hasUnits || !unitId) return department.label;
  const unit = PNIMIT_UNIT_BY_ID.get(unitId);
  return unit ? `${department.label} ${unit.label}` : department.label;
}

/**
 * Short location for the calendar chip — see `Department.shortLabel` for why
 * this differs from `formatLocation`.
 */
export function formatChipLabel(
  departmentId: DepartmentId,
  unitId: PnimitUnitId | null,
): string {
  const department = getDepartment(departmentId);
  if (!department.hasUnits || !unitId) return department.shortLabel;
  const unit = PNIMIT_UNIT_BY_ID.get(unitId);
  return unit ? `${department.shortLabel} ${unit.label}` : department.shortLabel;
}
