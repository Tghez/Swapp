/**
 * Minimal class-name joiner. Deliberately not clsx + tailwind-merge: nothing in
 * this app overrides a utility conditionally, so a two-line helper covers every
 * call site without two more dependencies.
 */
export function cn(...values: unknown[]): string {
  // Filtering on the type rather than truthiness keeps `cond && "class"` safe
  // when `cond` is a number — a falsy 0 would otherwise stringify into the
  // class list.
  return values
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join(" ");
}
