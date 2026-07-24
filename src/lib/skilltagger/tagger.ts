import { callStructured } from "@/lib/claude";
import type { Theme } from "@/lib/skills";
import { buildTagUserPrompt, TAG_SYSTEM_PROMPT, TAG_TOOL_NAME, type ExistingSkillNode } from "./prompt";
import { tagOutputJsonSchema, tagOutputSchema, type TagOutput } from "./schema";

export type { ExistingSkillNode, TagContentInput } from "./prompt";

export interface TagResultMatch {
  match: string; // slug of the existing node
}

export interface TagResultPropose {
  propose: {
    slug: string;
    title: string;
    theme: Theme;
    description: string;
  };
}

export type TagResult = TagResultMatch | TagResultPropose;

/**
 * Signature of the structured-call dependency — same shape as
 * StructuredCaller in src/lib/enrichment/run.ts / src/lib/feedback/run.ts,
 * itself the StructuredCallOptions signature from src/lib/claude.ts. This is
 * the executor seam (ADR 0015): callers inject whichever executor the
 * profile resolved (src/lib/executor/executor.ts's `Executor` has this same
 * shape) so tagContent works unchanged under both `api` and `claude-code` —
 * there is deliberately NO direct anthropicClient()/API call in this module.
 */
export type StructuredCaller = (opts: {
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}) => Promise<unknown>;

/**
 * Match-or-Propose core (ADR 0009, T12.3): one structured call gets the
 * item's info plus the complete current *active* node list and either picks
 * a match or proposes a new node. No embeddings — the full node list rides
 * along in the prompt every time, which is only viable while the taxonomy
 * fits in context (a few dozen nodes). Scaling seam: once the active list
 * grows too large for the prompt, this is the place to add an embedding-based
 * pre-filter/dedup step in front of the LLM call (ADR 0009 explicitly defers
 * this, not needed for the current scale).
 */
export async function tagContent(
  input: { hint: string | null; title: string; text: string },
  existingNodes: ExistingSkillNode[],
  caller: StructuredCaller = callStructured,
): Promise<TagResult> {
  const raw = await caller({
    system: TAG_SYSTEM_PROMPT,
    user: buildTagUserPrompt(input, existingNodes),
    toolName: TAG_TOOL_NAME,
    inputSchema: tagOutputJsonSchema as unknown as Record<string, unknown>,
  });
  const output = tagOutputSchema.parse(raw);
  return toResult(output);
}

function toResult(output: TagOutput): TagResult {
  if (output.decision === "match") {
    // Non-null guaranteed by tagOutputSchema's refine.
    return { match: output.match_slug as string };
  }
  return {
    propose: {
      slug: output.propose_slug as string,
      title: output.propose_title as string,
      theme: output.propose_theme as Theme,
      description: output.propose_description as string,
    },
  };
}
