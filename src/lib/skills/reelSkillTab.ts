import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { experienceReports, rawItems, reels, skillNodes } from "@/db/schema";
import { UNTOUCHED_STATUS, getProgressMap, type DisplayStatus } from "@/lib/skills/progress";

/**
 * T18.7 (§5.2, §7 #8): batch data access for the Reel Detail's Skill tab.
 * Mirrors `getInteractionFlags`'s batching pattern (`src/lib/interactions.ts`)
 * — one call per feed page load, keyed by skill slug, rather than a
 * per-reel-card query. `getSkillTabInfoForSlugs` deliberately does NOT
 * exclude any particular reel's own content from `items`; that's a
 * per-render concern (a reel shouldn't see itself in its own "also under
 * this skill" preview), handled by the pure `pickSkillTabPreview` helper
 * below so the batch query stays reel-agnostic and cacheable per slug.
 */

export interface SkillTabPreviewItem {
  type: "reel" | "report";
  id: number;
  title: string;
  date: Date;
}

export interface SkillTabInfo {
  slug: string;
  title: string;
  theme: string;
  description: string;
  status: DisplayStatus;
  /** Every Reel/Report tagged with this skill, newest first. Includes the
   *  calling reel itself — see `pickSkillTabPreview`. */
  items: SkillTabPreviewItem[];
}

/**
 * Batch-fetches Skill-tab data for every distinct skill slug present in a
 * set of feed reels. Slugs with no matching `active` skill node (shouldn't
 * normally happen once SkillTagger has matched a reel to it, but a node
 * could in principle be un-confirmed/removed after the fact) are simply
 * absent from the returned map — callers treat that the same as "no skill"
 * (T18.7: no skill -> the tab hides).
 */
export async function getSkillTabInfoForSlugs(slugs: string[]): Promise<Map<string, SkillTabInfo>> {
  const uniqueSlugs = [...new Set(slugs)];
  const map = new Map<string, SkillTabInfo>();
  if (uniqueSlugs.length === 0) return map;

  const nodes = await db()
    .select()
    .from(skillNodes)
    .where(and(inArray(skillNodes.slug, uniqueSlugs), eq(skillNodes.status, "active")));
  if (nodes.length === 0) return map;

  const nodeIds = nodes.map((n) => n.id);
  const [progressMap, reelRows, reportRows] = await Promise.all([
    getProgressMap(nodeIds),
    db()
      .select({ skill: reels.skill, id: reels.id, title: rawItems.title, date: rawItems.publishedAt })
      .from(reels)
      .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
      .where(inArray(reels.skill, uniqueSlugs)),
    db()
      .select({
        skill: experienceReports.skill,
        id: experienceReports.id,
        title: experienceReports.title,
        date: experienceReports.createdAt,
      })
      .from(experienceReports)
      .where(and(inArray(experienceReports.skill, uniqueSlugs), eq(experienceReports.lifecycleState, "active"))),
  ]);

  const itemsBySlug = new Map<string, SkillTabPreviewItem[]>();
  for (const r of reelRows) {
    if (!r.skill) continue;
    const list = itemsBySlug.get(r.skill) ?? [];
    list.push({ type: "reel", id: r.id, title: r.title, date: r.date });
    itemsBySlug.set(r.skill, list);
  }
  for (const r of reportRows) {
    if (!r.skill) continue;
    const list = itemsBySlug.get(r.skill) ?? [];
    list.push({ type: "report", id: r.id, title: r.title, date: r.date });
    itemsBySlug.set(r.skill, list);
  }
  for (const list of itemsBySlug.values()) list.sort((a, b) => b.date.getTime() - a.date.getTime());

  for (const node of nodes) {
    map.set(node.slug, {
      slug: node.slug,
      title: node.title,
      theme: node.theme,
      description: node.description,
      status: progressMap.get(node.id)?.status ?? UNTOUCHED_STATUS,
      items: itemsBySlug.get(node.slug) ?? [],
    });
  }
  return map;
}

export interface SkillTabPreview {
  otherItems: SkillTabPreviewItem[];
  moreCount: number;
}

/**
 * Pure helper (no DB access): a reel's own row shouldn't appear in its own
 * "also under this skill" preview. Excludes it, then caps the remainder at
 * `max` (T18.7: "up to 2 other associated items").
 */
export function pickSkillTabPreview(info: SkillTabInfo, excludeReelId: number, max = 2): SkillTabPreview {
  const others = info.items.filter((it) => !(it.type === "reel" && it.id === excludeReelId));
  return { otherItems: others.slice(0, max), moreCount: Math.max(0, others.length - max) };
}
