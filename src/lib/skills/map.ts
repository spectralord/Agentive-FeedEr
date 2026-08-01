import { desc, eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { experienceReports, rawItems, reels, skillNodes } from "@/db/schema";
import type { SkillNode, UserProgress, UserProgressNote } from "@/db/schema";
import type { Theme } from "@/lib/skills";
import { listActiveNodes } from "@/lib/skilltagger/nodes";
import { countEvidenceForNodes, listActionablesForNode, type ActionableListItem } from "@/lib/actionables";
import {
  UNTOUCHED_STATUS,
  getProgress,
  getProgressMap,
  isProgressStatus,
  listNotesForNode,
  setProgress,
  type DisplayStatus,
} from "@/lib/skills/progress";

/**
 * Read side of the Skill Map (T7.3): active `skill_nodes` (created by Epic
 * 12's SkillTagger, Match-or-Propose) grouped by theme, each annotated with
 * its content count and the user's current self-declared status. No
 * graph/tree layout, no gates — a flat, groupable list (Skill *Map*,
 * Variante A).
 */

export interface SkillMapNode {
  id: number;
  slug: string;
  title: string;
  theme: Theme;
  description: string;
  /** Reels + active experience reports tagged with this node's slug. Not
   *  quality/experimental-filtered — this is an index of everything
   *  assigned to the node, not the feed (see epic-7-skill-map.md Abweichungen). */
  contentCount: number;
  status: DisplayStatus;
  /** T18.5 (§5.1, experimental-dot): true when a majority (>50%) of this
   *  node's associated *Reels* are marked `experimental`. Reports have no
   *  `experimental` field and are excluded from both sides of the ratio. */
  experimentalDot: boolean;
  /** Epic 20 (ADR 0019 decision 2): the EVIDENCED track — count of completed
   *  Actionables rolled up to this node. Deliberately separate from `status`
   *  (the DECLARED track) and never combined into one number: "mastered
   *  with zero evidence" must stay fully representable. */
  evidenceCount: number;
}

export interface SkillMapTheme {
  theme: Theme;
  nodes: SkillMapNode[];
}

interface ContentCounts {
  counts: Map<string, number>;
  /** Slugs where >50% of associated Reels are `experimental` (T18.5's
   *  experimental-dot). Folded into the reel aggregate below rather than
   *  issuing a second query — the per-slug reel rows are already being
   *  scanned/grouped here. */
  experimentalMajority: Set<string>;
}

async function getContentCounts(slugs: string[]): Promise<ContentCounts> {
  const counts = new Map<string, number>();
  const experimentalMajority = new Set<string>();
  if (slugs.length === 0) return { counts, experimentalMajority };

  const reelCounts = await db()
    .select({
      skill: reels.skill,
      count: sql<number>`count(*)::int`,
      experimentalCount: sql<number>`count(*) filter (where ${reels.experimental})::int`,
    })
    .from(reels)
    .where(inArray(reels.skill, slugs))
    .groupBy(reels.skill);

  const reportCounts = await db()
    .select({ skill: experienceReports.skill, count: sql<number>`count(*)::int` })
    .from(experienceReports)
    .where(and(inArray(experienceReports.skill, slugs), eq(experienceReports.lifecycleState, "active")))
    .groupBy(experienceReports.skill);

  for (const row of reelCounts) {
    if (!row.skill) continue;
    counts.set(row.skill, (counts.get(row.skill) ?? 0) + row.count);
    if (row.count > 0 && row.experimentalCount / row.count > 0.5) {
      experimentalMajority.add(row.skill);
    }
  }
  for (const row of reportCounts) {
    if (!row.skill) continue;
    counts.set(row.skill, (counts.get(row.skill) ?? 0) + row.count);
  }
  return { counts, experimentalMajority };
}

/** Active nodes grouped by theme, themes in first-seen (alphabetical node
 *  title) order. Empty themes never appear — there is nothing to group if
 *  no active node declares them. */
export async function getSkillMap(): Promise<SkillMapTheme[]> {
  const activeNodes = await listActiveNodes();
  if (activeNodes.length === 0) return [];

  const slugs = activeNodes.map((n) => n.slug);
  const nodeIds = activeNodes.map((n) => n.id);
  const [{ counts, experimentalMajority }, progressMap, evidenceCounts] = await Promise.all([
    getContentCounts(slugs),
    getProgressMap(nodeIds),
    countEvidenceForNodes(nodeIds),
  ]);

  const byTheme = new Map<Theme, SkillMapNode[]>();
  for (const node of activeNodes) {
    const mapped: SkillMapNode = {
      id: node.id,
      slug: node.slug,
      title: node.title,
      theme: node.theme,
      description: node.description,
      contentCount: counts.get(node.slug) ?? 0,
      // T18.4 (§9.4): no `user_progress` row is "untouched", not "seen" —
      // stop collapsing the two.
      status: progressMap.get(node.id)?.status ?? UNTOUCHED_STATUS,
      experimentalDot: experimentalMajority.has(node.slug),
      // Epic 20: nodes with zero completions are absent from the map —
      // absent means 0, same convention as getInteractionFlags.
      evidenceCount: evidenceCounts.get(node.id) ?? 0,
    };
    const bucket = byTheme.get(node.theme);
    if (bucket) bucket.push(mapped);
    else byTheme.set(node.theme, [mapped]);
  }

  return [...byTheme.entries()].map(([theme, nodes]) => ({ theme, nodes }));
}

export interface AssociatedReel {
  type: "reel";
  id: number;
  title: string;
  url: string;
  publishedAt: Date;
}

export interface AssociatedReport {
  type: "report";
  id: number;
  title: string;
  authorLabel: string;
  createdAt: Date;
}

export type AssociatedContent = AssociatedReel | AssociatedReport;

export interface SkillNodeDetail {
  node: SkillNode;
  content: AssociatedContent[];
  status: DisplayStatus;
  notes: UserProgressNote[];
  /** Epic 20 (ADR 0019): this node's To-Try list — every tagged Reel with a
   *  non-null `action`, each with its completion state. */
  actionables: ActionableListItem[];
  /** Epic 20: the EVIDENCED track's count, parallel to `status` (the
   *  DECLARED track) — see `SkillMapNode.evidenceCount`'s comment. */
  evidenceCount: number;
}

/** Node + associated content + current status + note history, for the
 *  `/skills/[slug]` detail view. Only resolves `active` nodes — `pending`
 *  proposals are handled by the confirm/merge/discard flow above, not here. */
export async function getNodeDetail(slug: string): Promise<SkillNodeDetail | undefined> {
  const [node] = await db()
    .select()
    .from(skillNodes)
    .where(and(eq(skillNodes.slug, slug), eq(skillNodes.status, "active")));
  if (!node) return undefined;

  const [reelRows, reportRows, status, notes, actionables, evidenceCounts] = await Promise.all([
    db()
      .select({ id: reels.id, title: rawItems.title, url: rawItems.url, publishedAt: rawItems.publishedAt })
      .from(reels)
      .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
      .where(eq(reels.skill, slug))
      .orderBy(desc(rawItems.publishedAt)),
    db()
      .select({
        id: experienceReports.id,
        title: experienceReports.title,
        authorLabel: experienceReports.authorLabel,
        createdAt: experienceReports.createdAt,
      })
      .from(experienceReports)
      .where(and(eq(experienceReports.skill, slug), eq(experienceReports.lifecycleState, "active")))
      .orderBy(desc(experienceReports.createdAt)),
    getProgress(node.id),
    listNotesForNode(node.id),
    listActionablesForNode(node.id),
    countEvidenceForNodes([node.id]),
  ]);

  const content: AssociatedContent[] = [
    ...reelRows.map((r): AssociatedReel => ({ type: "reel", ...r })),
    ...reportRows.map((r): AssociatedReport => ({ type: "report", ...r })),
  ];

  return {
    node,
    content,
    // T18.4 (§9.4): no `user_progress` row is "untouched", not "seen".
    status: status?.status ?? UNTOUCHED_STATUS,
    notes,
    actionables,
    evidenceCount: evidenceCounts.get(node.id) ?? 0,
  };
}

export interface ProgressChangeResult {
  row: UserProgress;
  /** Status before this call — `UNTOUCHED_STATUS` if there was no row yet.
   *  Lets the route handler tell `SkillRing` (T18.5) whether a real
   *  transition happened, so the ring-fill animation plays only on an
   *  actual change, never on an ordinary page view. */
  previousStatus: DisplayStatus;
}

/**
 * Slug-addressed wrapper around `setProgress` for the `/skills/[slug]/progress`
 * route handler (routes address nodes by slug, like the rest of the UI;
 * `user_progress` itself is keyed by the numeric skill_node_id). Only
 * resolves `active` nodes, same restriction as `getNodeDetail`. Returns
 * `undefined` if the slug/status is invalid so the route can 404/400.
 */
export async function setProgressBySlug(
  slug: string,
  status: string,
  note?: string,
): Promise<ProgressChangeResult | undefined> {
  if (!isProgressStatus(status)) return undefined;

  const [node] = await db()
    .select({ id: skillNodes.id })
    .from(skillNodes)
    .where(and(eq(skillNodes.slug, slug), eq(skillNodes.status, "active")));
  if (!node) return undefined;

  // Read before write — the one place we need to know what the status was
  // a moment ago, purely so the caller can decide whether to animate.
  const before = await getProgress(node.id);
  const previousStatus: DisplayStatus = before?.status ?? UNTOUCHED_STATUS;

  const row = await setProgress(node.id, status, note);
  return { row, previousStatus };
}
