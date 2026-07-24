import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { experienceReports } from "@/db/schema";
import type { ExperienceReport } from "@/db/schema";

/**
 * Data access for Epic 9 experience reports — a separate content type from
 * `reels` (ADR 0007): not sourced-only, carries an author instead of a
 * source. Lifecycle follows ADR 0008 (`active -> deprecated -> archived`,
 * no auto-delete); this module never deletes a row except via the explicit
 * `deleteReport` escape hatch.
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

function isKnownAuthorType(value: string): value is AuthorType {
  return (AUTHOR_TYPES as readonly string[]).includes(value);
}

export interface ListReportsOptions {
  /** Exact author_type match. Unknown values are ignored (no filter applied). */
  authorType?: string;
  /** lifecycle_state values to include; default is `["active"]` only (ADR 0008). */
  states?: LifecycleState[];
  /** Max rows returned, default 200. */
  limit?: number;
}

export interface CreateReportInput {
  title: string;
  body: string;
  authorType: AuthorType;
  authorLabel: string;
  important?: boolean;
  relevanceScore?: number | null;
  skill?: string | null;
  sourceUrl?: string | null;
}

export interface UpdateReportInput {
  title?: string;
  body?: string;
  important?: boolean;
}

export interface SetLifecycleStateOptions {
  reason?: string | null;
  supersededByReportId?: number | null;
}

/** Reports newest first. Default view shows only `active` (T9.3). */
export async function listReports(opts: ListReportsOptions = {}): Promise<ExperienceReport[]> {
  const conditions = [];

  if (opts.authorType && isKnownAuthorType(opts.authorType)) {
    conditions.push(eq(experienceReports.authorType, opts.authorType));
  }

  const states = opts.states && opts.states.length > 0 ? opts.states : (["active"] as LifecycleState[]);
  conditions.push(inArray(experienceReports.lifecycleState, states));

  return db()
    .select()
    .from(experienceReports)
    .where(and(...conditions))
    .orderBy(desc(experienceReports.createdAt))
    .limit(opts.limit ?? DEFAULT_REPORT_LIMIT);
}

export async function getReport(id: number): Promise<ExperienceReport | undefined> {
  const [row] = await db().select().from(experienceReports).where(eq(experienceReports.id, id));
  return row;
}

export async function createReport(input: CreateReportInput): Promise<ExperienceReport> {
  const [row] = await db()
    .insert(experienceReports)
    .values({
      title: input.title,
      body: input.body,
      authorType: input.authorType,
      authorLabel: input.authorLabel,
      important: input.important ?? false,
      relevanceScore: input.relevanceScore ?? null,
      skill: input.skill ?? null,
      sourceUrl: input.sourceUrl ?? null,
    })
    .returning();
  return row;
}

export async function updateReport(
  id: number,
  input: UpdateReportInput,
): Promise<ExperienceReport | undefined> {
  const [row] = await db()
    .update(experienceReports)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(experienceReports.id, id))
    .returning();
  return row;
}

/**
 * Moves a report between lifecycle states (ADR 0008). Reactivating (state
 * `active`) with no reason/supersededByReportId clears both, as expected for
 * "back to normal".
 */
export async function setLifecycleState(
  id: number,
  state: LifecycleState,
  opts: SetLifecycleStateOptions = {},
): Promise<ExperienceReport | undefined> {
  const [row] = await db()
    .update(experienceReports)
    .set({
      lifecycleState: state,
      lifecycleReason: opts.reason ?? null,
      supersededByReportId: opts.supersededByReportId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(experienceReports.id, id))
    .returning();
  return row;
}

/**
 * Hard delete — a rare, deliberate manual escape hatch (ADR 0008), NOT the
 * normal way to retire a report. Use `setLifecycleState` for that.
 */
export async function deleteReport(id: number): Promise<void> {
  await db().delete(experienceReports).where(eq(experienceReports.id, id));
}
