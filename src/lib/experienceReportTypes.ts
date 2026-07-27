/**
 * Pure vocabulary for Epic 9 experience reports — **no DB imports**, so
 * Client Components can use these constants without dragging `pg` into the
 * browser bundle (T18.14). `./experienceReports` re-exports everything here,
 * so server-side importers keep working unchanged: one source of truth, two
 * entry points. Same split as `./skills/progressStatus` vs `./skills/progress`.
 */

export const AUTHOR_TYPES = ["own", "curated", "colleague"] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const LIFECYCLE_STATES = ["active", "deprecated", "archived"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const AUTHOR_TYPE_LABELS: Record<AuthorType, string> = {
  own: "Own",
  curated: "Curated",
  colleague: "Colleague",
};

export const DEFAULT_REPORT_LIMIT = 200;

export function isKnownAuthorType(value: string): value is AuthorType {
  return (AUTHOR_TYPES as readonly string[]).includes(value);
}
