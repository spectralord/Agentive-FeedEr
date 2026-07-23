import { THEMES } from "@/lib/skills";

export const TAG_TOOL_NAME = "submit_skill_tag";

export const TAG_SYSTEM_PROMPT = `You assign one piece of content to a canonical "skill node" (a competency/topic) out of a personal knowledge base, or propose a new node when none fits (Match-or-Propose).

Binding rules:
- You are given the CURRENT list of existing active skill nodes (slug, title, description). Pick "match" only if the content is genuinely about the same competency as one of them — not just a superficial keyword overlap. When in doubt, "propose" instead of forcing a weak match (a wrong match pollutes that node forever; a proposal just waits for confirmation).
- If the existing list is empty, or nothing fits, "propose" a new node.
- A proposal's slug must be a short English kebab-case identifier (e.g. "prompt-caching", "mcp-servers") distinct from all existing slugs.
- A proposal's title and description are short, factual German UI text — no hype language.
- A proposal's theme must be exactly one of: ${THEMES.join(", ")}.
- Never invent a match_slug that isn't in the provided list.
- Answer exclusively via the ${TAG_TOOL_NAME} tool.`;

export interface ExistingSkillNode {
  slug: string;
  title: string;
  description: string;
}

export interface TagContentInput {
  /** Free-text competency guess (e.g. enrichment's skill_hint), if any. */
  hint: string | null;
  title: string;
  text: string;
}

export function buildTagUserPrompt(
  input: TagContentInput,
  existingNodes: ExistingSkillNode[],
): string {
  const nodeLines =
    existingNodes.length > 0
      ? existingNodes.map((n) => `- ${n.slug}: ${n.title} — ${n.description}`)
      : ["(none yet)"];

  return [
    "## Existing active skill nodes",
    ...nodeLines,
    "",
    "## Content to assign",
    `Title: ${input.title}`,
    `Competency hint: ${input.hint ?? "(none)"}`,
    "",
    "### Text",
    input.text,
  ].join("\n");
}
