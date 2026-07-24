import { callStructured } from "@/lib/claude";
import {
  buildClusterUserPrompt,
  CLUSTER_SYSTEM_PROMPT,
  CLUSTER_TOOL_NAME,
  type CandidateCluster,
  type ClusterContentInput,
} from "./prompt";
import { clusterOutputJsonSchema, clusterOutputSchema, type ClusterOutput } from "./schema";

export type { CandidateCluster, ClusterContentInput } from "./prompt";

export interface ClusterResultMatch {
  match: { clusterId: number; isPrimary: boolean };
}

export interface ClusterResultPropose {
  propose: { title: string };
}

export type ClusterResult = ClusterResultMatch | ClusterResultPropose;

/**
 * Signature of the structured-call dependency — same shape as
 * StructuredCaller in src/lib/skilltagger/tagger.ts / the Executor type in
 * src/lib/executor/executor.ts. This is the executor seam (ADR 0015): callers
 * inject whichever executor the profile resolved so assignCluster works
 * unchanged under both `api` and `claude-code` — there is deliberately NO
 * direct anthropicClient()/API call in this module.
 */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

/**
 * Match-or-Propose core (ADR 0009 pattern, ADR 0013 for clustering
 * specifics): one structured call gets the new reel's info plus the current
 * *active* candidate cluster list (id, title, member source names) and
 * either picks a match (with an is_primary judgement) or proposes a new
 * cluster. No embeddings — the candidate list rides along in the prompt
 * every time (bounded by MAX_CLUSTER_CANDIDATES), same scaling seam note as
 * the SkillTagger.
 */
export async function assignCluster(
  input: ClusterContentInput,
  candidates: CandidateCluster[],
  caller: StructuredCaller = callStructured,
): Promise<ClusterResult> {
  const raw = await caller({
    system: CLUSTER_SYSTEM_PROMPT,
    user: buildClusterUserPrompt(input, candidates),
    toolName: CLUSTER_TOOL_NAME,
    inputSchema: clusterOutputJsonSchema as unknown as Record<string, unknown>,
  });
  const output = clusterOutputSchema.parse(raw);
  return toResult(output);
}

function toResult(output: ClusterOutput): ClusterResult {
  if (output.decision === "match") {
    // Non-null guaranteed by clusterOutputSchema's refine.
    return { match: { clusterId: output.match_cluster_id as number, isPrimary: output.is_primary } };
  }
  // ADR 0013 point 4: the first member of a newly-proposed cluster is primary
  // by definition — the model's is_primary judgement is not consulted here
  // (there is nothing yet in the cluster to be a reblog of).
  return { propose: { title: output.propose_title as string } };
}
