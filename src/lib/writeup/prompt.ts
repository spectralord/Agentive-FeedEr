export const WRITEUP_TOOL_NAME = "submit_writeup";

/**
 * On-demand Write-up generation (ADR 0024, T19.1): a longer, more discursive
 * piece of prose than the Compact card's one-paragraph `summary` — "what
 * does this actually mean, what's the context" rather than a news-brief
 * (ADR 0017 decision 1). Sourced-only (ADR 0005): the model elaborates on
 * the supplied source content, never fetches anything new (that is
 * Deep-Dive's job, a different, agentic feature — Epic 8, not this one),
 * and never adds a claim the source doesn't support. Per ADR 0003, thin
 * source content is a `null` result, not an invitation to pad.
 */
export const WRITEUP_SYSTEM_PROMPT = `You are writing a longer-form write-up for a single item in a reader's feed. You have no external knowledge, no web access, and no ability to fetch anything beyond the source content supplied below.

Binding rules:
- Elaborate ONLY on what the supplied source content actually says. Add no claims, no outside knowledge, and no invented examples — everything you write must be traceable back to the supplied source content.
- If the supplied source content is too thin to honestly elaborate on beyond what the summary already says, return null. Padding with generic or invented material is worse than returning null — null is the correct, expected answer for a thin source.
- When you do write, write a few paragraphs of plain prose. No headings, no bullet lists, no markdown formatting — just prose, as if explaining the item to a colleague.
- Answer exclusively via the ${WRITEUP_TOOL_NAME} tool.`;

export interface WriteupSourceInput {
  title: string;
  sourceName: string;
  rawContent: string;
}

export interface WriteupReelInput {
  summary: string;
}

export function buildWriteupUserPrompt(source: WriteupSourceInput, reel: WriteupReelInput): string {
  const lines = [
    "## Source",
    `Title: ${source.title}`,
    `Source: ${source.sourceName}`,
    "",
    "### Source text",
    source.rawContent || "(no content beyond the title)",
    "",
    "## Existing short summary (for context — do not just repeat this)",
    reel.summary,
  ];
  return lines.join("\n");
}
