import { and, eq, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type * as schema from "@/db/schema";
import { rawItems, reels, topicClusters } from "@/db/schema";
import { callStructured } from "@/lib/claude";
import { env } from "@/lib/env";

/**
 * Signature of the structured-call dependency — same shape as
 * src/lib/clustering/cluster.ts's StructuredCaller / the Executor type in
 * src/lib/executor/executor.ts. Executor seam (ADR 0015): there is
 * deliberately NO direct anthropicClient()/API call in this module.
 */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
  model?: string;
}) => Promise<unknown>;

export const FRESHNESS_TOOL_NAME = "submit_freshness_check";

/**
 * ADR 0012/0013, T11.3: a *grounded* comparison only — explicit deprecation
 * signals in the text (changelog language, "deprecated", "replaced by",
 * the author's own statement), never an inference from vague recency or
 * general topic similarity. Conservative in both directions (ADR 0003):
 * null unless the signal is clear. Applying a non-null result never flips
 * `lifecycle_state` itself (T11.5 is the human-in-the-loop confirmation,
 * ADR 0008) — this module only ever writes a *proposal*.
 */
export const FRESHNESS_SYSTEM_PROMPT = `You compare topic clusters that share a broad skill area to detect whether one cluster's content has been superseded by another's — e.g. "the batch parameter" superseded by "the fork parameter" because the source material says so explicitly.

Binding rules:
- You are given a set of candidate clusters (id, title, and each member's title + summary) that all relate to the same broad skill area.
- Only report a supersession when the provided text contains an EXPLICIT, grounded signal — changelog language, the word "deprecated"/"replaced by"/"superseded by", or an author explicitly stating the older thing no longer applies. General recency, a newer publish date alone, or topic similarity is NOT enough.
- If genuinely unclear, if no such explicit signal exists, or if the clusters are simply unrelated/independent topics, return null for superseded_cluster_id, superseded_by_cluster_id, and reason.
- Never invent a cluster id that is not in the provided candidate list.
- A cluster can never supersede itself.
- "reason" is a short, factual, grounded restatement of the explicit signal found in the text — no speculation.
- Answer exclusively via the ${FRESHNESS_TOOL_NAME} tool.`;

export interface FreshnessMember {
  title: string;
  summary: string;
}

export interface FreshnessCandidateCluster {
  id: number;
  title: string;
  members: FreshnessMember[];
}

/** One skill-sharing candidate group (T11.3: "clusters that share a skill-node
 *  are freshness-comparison candidates against each other"). */
export interface FreshnessCandidateGroup {
  skill: string;
  clusters: FreshnessCandidateCluster[];
}

export function buildFreshnessUserPrompt(group: FreshnessCandidateGroup): string {
  const clusterBlocks = group.clusters.map((c) => {
    const memberLines = c.members.map((m) => `  - ${m.title}: ${m.summary}`).join("\n");
    return `[id ${c.id}] ${c.title}\n${memberLines}`;
  });

  return [
    `## Skill area: ${group.skill}`,
    "## Candidate clusters (compare these against each other)",
    ...clusterBlocks,
  ].join("\n\n");
}

const freshnessOutputSchema = z
  .object({
    superseded_cluster_id: z.number().int().positive().nullable(),
    superseded_by_cluster_id: z.number().int().positive().nullable(),
    reason: z.string().min(1).nullable(),
  })
  .refine((o) => (o.superseded_cluster_id === null) === (o.superseded_by_cluster_id === null), {
    message: "superseded_cluster_id and superseded_by_cluster_id must both be null or both be set",
    path: ["superseded_by_cluster_id"],
  })
  .refine((o) => (o.superseded_cluster_id === null) === (o.reason === null), {
    message: "reason must be set iff a supersession is found",
    path: ["reason"],
  })
  .refine(
    (o) => o.superseded_cluster_id === null || o.superseded_cluster_id !== o.superseded_by_cluster_id,
    { message: "a cluster cannot supersede itself", path: ["superseded_by_cluster_id"] },
  );

type FreshnessOutput = z.infer<typeof freshnessOutputSchema>;

/** JSON schema handed to the model as forced tool input (kept in sync with zod above). */
export const freshnessOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["superseded_cluster_id", "superseded_by_cluster_id", "reason"],
  properties: {
    superseded_cluster_id: {
      type: ["number", "null"],
      description:
        "The id of the candidate cluster whose content is superseded (older/replaced), or null if no explicit supersession signal was found.",
    },
    superseded_by_cluster_id: {
      type: ["number", "null"],
      description:
        "The id of the candidate cluster that supersedes it (newer/replacement), or null. Required iff superseded_cluster_id is set.",
    },
    reason: {
      type: ["string", "null"],
      description:
        "A short, grounded restatement of the explicit deprecation/replacement signal found in the text. Required iff a supersession is found, else null.",
    },
  },
} as const;

export interface FreshnessResult {
  supersededClusterId: number | null;
  supersededByClusterId: number | null;
  reason: string | null;
}

function toResult(output: FreshnessOutput): FreshnessResult {
  return {
    supersededClusterId: output.superseded_cluster_id,
    supersededByClusterId: output.superseded_by_cluster_id,
    reason: output.reason,
  };
}

/**
 * One grounded LLM comparison over a candidate group (T11.3 core). Returns
 * an all-null result when the model finds no explicit supersession signal.
 */
export async function compareCandidateGroup(
  group: FreshnessCandidateGroup,
  caller: StructuredCaller = callStructured,
): Promise<FreshnessResult> {
  const raw = await caller({
    system: FRESHNESS_SYSTEM_PROMPT,
    user: buildFreshnessUserPrompt(group),
    toolName: FRESHNESS_TOOL_NAME,
    inputSchema: freshnessOutputJsonSchema as unknown as Record<string, unknown>,
    model: knowledgeCheckModel(),
  });
  const output = freshnessOutputSchema.parse(raw);
  return toResult(output);
}

/**
 * Candidate-pairing (T11.3): clusters that share a skill-node (`reels.skill`,
 * Epic 12) via their member reels are compared against each other — only
 * `active` clusters, only groups with >= 2 distinct clusters (a group of 1
 * has nothing to compare against). When `clusterIdFilter` is given (T11.6
 * gating), only groups containing at least one of those cluster ids are
 * returned — but every cluster in a matching group still rides along for
 * full context (the "old" cluster a dirty one might supersede needn't itself
 * be dirty).
 */
export async function loadSkillSharingGroups(
  db: NodePgDatabase<typeof schema>,
  clusterIdFilter?: number[],
): Promise<FreshnessCandidateGroup[]> {
  const rows = await db
    .select({
      skill: reels.skill,
      clusterId: topicClusters.id,
      clusterTitle: topicClusters.title,
      title: rawItems.title,
      summary: reels.summary,
    })
    .from(reels)
    .innerJoin(topicClusters, eq(reels.topicClusterId, topicClusters.id))
    .innerJoin(rawItems, eq(reels.rawItemId, rawItems.id))
    .where(and(isNotNull(reels.skill), eq(topicClusters.lifecycleState, "active")));

  const bySkill = new Map<string, Map<number, FreshnessCandidateCluster>>();
  for (const row of rows) {
    const skill = row.skill as string; // isNotNull above
    const clustersForSkill = bySkill.get(skill) ?? new Map<number, FreshnessCandidateCluster>();
    const cluster = clustersForSkill.get(row.clusterId) ?? {
      id: row.clusterId,
      title: row.clusterTitle,
      members: [],
    };
    cluster.members.push({ title: row.title, summary: row.summary });
    clustersForSkill.set(row.clusterId, cluster);
    bySkill.set(skill, clustersForSkill);
  }

  const filterSet = clusterIdFilter ? new Set(clusterIdFilter) : undefined;

  const groups: FreshnessCandidateGroup[] = [];
  for (const [skill, clusterMap] of bySkill.entries()) {
    if (clusterMap.size < 2) continue; // nothing to compare against
    if (filterSet && ![...clusterMap.keys()].some((id) => filterSet.has(id))) continue;
    groups.push({ skill, clusters: [...clusterMap.values()] });
  }
  return groups;
}

/**
 * Applies a non-null FreshnessResult: sets `superseded_by_cluster_id` +
 * `supersede_reason` on the superseded (older) cluster. Deliberately does
 * NOT touch `lifecycle_state` — that stays `active` until a human confirms
 * via the T11.5 route (conservative, ADR 0008 human-in-the-loop). No-op for
 * an all-null result.
 */
export async function applyFreshnessResult(
  db: NodePgDatabase<typeof schema>,
  result: FreshnessResult,
): Promise<void> {
  if (result.supersededClusterId === null) return; // refine() guarantees the other fields are null too
  await db
    .update(topicClusters)
    .set({
      supersededByClusterId: result.supersededByClusterId,
      supersedeReason: result.reason,
    })
    .where(eq(topicClusters.id, result.supersededClusterId));
}

export interface FreshnessCheckResult {
  groupsChecked: number;
  supersededFound: number;
  failed: number;
}

/**
 * Batch sweep over skill-sharing candidate groups (T11.3). Not itself gated
 * by `knowledge_checked_at` — that "only re-check clusters with new members"
 * gating is T11.6's job (src/lib/knowledge-check/run.ts), which passes a
 * `clusterIdFilter` of "dirty" cluster ids into loadSkillSharingGroups.
 * Per-group try/catch — one group's failure never aborts the sweep (same
 * never-abort-the-run contract as clustering/skilltagger).
 */
export async function runFreshnessCheck(
  db: NodePgDatabase<typeof schema>,
  caller: StructuredCaller = callStructured,
  opts: { clusterIdFilter?: number[] } = {},
): Promise<FreshnessCheckResult> {
  const groups = await loadSkillSharingGroups(db, opts.clusterIdFilter);

  let supersededFound = 0;
  let failed = 0;

  for (const group of groups) {
    try {
      const result = await compareCandidateGroup(group, caller);
      if (result.supersededClusterId !== null) {
        const validIds = new Set(group.clusters.map((c) => c.id));
        // ADR 0003 / clustering precedent: never trust an id the model
        // invented outside the provided candidate list.
        if (!validIds.has(result.supersededClusterId) || !validIds.has(result.supersededByClusterId as number)) {
          console.error(
            `[knowledge-check/freshness] model returned an id outside the candidate group (skill=${group.skill}), ignoring`,
          );
          continue;
        }
        await applyFreshnessResult(db, result);
        supersededFound++;
      }
    } catch (error) {
      failed++;
      console.error(`[knowledge-check/freshness] group (skill=${group.skill}) failed:`, error);
    }
  }

  return { groupsChecked: groups.length, supersededFound, failed };
}

/** KNOWLEDGE_CHECK_MODEL falls back to ANTHROPIC_MODEL, same `?? ` pattern
 *  callStructured itself uses for its own `model` option (src/lib/claude.ts). */
export function knowledgeCheckModel(): string {
  return env().KNOWLEDGE_CHECK_MODEL ?? env().ANTHROPIC_MODEL;
}
