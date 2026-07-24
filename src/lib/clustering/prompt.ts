export const CLUSTER_TOOL_NAME = "submit_cluster_assignment";

/**
 * ADR 0013: narrow/specific granularity ("the batch command and its usage",
 * not the broad skill area — that's the Skill-Node, Epic 12) and the
 * `is_primary` semantics (first-hand vs. reblog), conservative in both
 * directions per ADR 0003 ("nichts erfinden"): propose over a weak match,
 * is_primary=true when in doubt.
 */
export const CLUSTER_SYSTEM_PROMPT = `You assign one reel (a short summarized piece of content) to a topic cluster — a narrow, specific grouping of reels about the exact same concrete thing and its usage (example: "the batch command and how to use it"), NOT a broad skill or theme area (that broader grouping is a separate mechanism and not your concern here).

Binding rules:
- You are given the CURRENT list of active candidate clusters (id, title, and the source names of reels already in each). Pick "match" only if the new reel is genuinely about the same narrow, specific topic as one of them — the same concrete claim/feature/announcement, not just the same general subject area. A superficial keyword or theme overlap is NOT enough.
- When in doubt, "propose" a new cluster instead of forcing a weak match — a wrong match pollutes that cluster's source count forever; a new cluster costs nothing.
- If the candidate list is empty, or nothing fits closely enough, "propose" a new cluster.
- A proposed cluster's title is a short, specific, factual English title naming the concrete thing — no hype language.
- When decision=match, judge "is_primary": true if this reel is an independent/first-hand account of the topic (an official primary source, the author's own test/experience); false if it is a recognizable restatement/reblog of one of the cluster's existing sources (links to it or repeats it without its own independent observation). When in doubt, "is_primary" is true (conservative — better to over-count independent sources than mislabel one as an echo).
- Never invent a match_cluster_id that isn't in the provided candidate list.
- Answer exclusively via the ${CLUSTER_TOOL_NAME} tool.`;

export interface CandidateCluster {
  id: number;
  title: string;
  /** Source names of reels already assigned to this cluster — brief context for the is_primary judgement. */
  memberSourceNames: string[];
}

export interface ClusterContentInput {
  title: string;
  summary: string;
  sourceName: string;
}

export function buildClusterUserPrompt(
  input: ClusterContentInput,
  candidates: CandidateCluster[],
): string {
  const clusterLines =
    candidates.length > 0
      ? candidates.map((c) => {
          const members =
            c.memberSourceNames.length > 0 ? c.memberSourceNames.join(", ") : "none yet";
          return `- [id ${c.id}] ${c.title} (sources already in this cluster: ${members})`;
        })
      : ["(none yet)"];

  return [
    "## Candidate topic clusters (active window)",
    ...clusterLines,
    "",
    "## New reel to assign",
    `Source: ${input.sourceName}`,
    `Title: ${input.title}`,
    `Summary: ${input.summary}`,
  ].join("\n");
}
