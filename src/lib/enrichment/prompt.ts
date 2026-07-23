import type { RawItem, Source } from "@/db/schema";

export const ENRICHMENT_TOOL_NAME = "submit_reel";

export const ENRICHMENT_SYSTEM_PROMPT = `You turn one raw AI-news item into one structured "reel" for a developer feed.

Binding rules:
- SOURCED-ONLY: "example" and "action" MUST only contain what is directly supported by the provided source text. If the source contains no usable example or action, return null for that field. Never invent, extrapolate, or embellish. Returning null is always better than guessing.
- "summary": German, 2-4 sentences, factual and concrete. No hype language, no marketing phrasing.
- "action": German, exactly one concrete sentence the developer can act on (e.g. "Probier X mit ...", "Ersetz Y durch Z ..."), only if supported by the source.
- "effort_tag": only when "action" is set, else null. Meaning: "5-min-test" = immediately tryable; "afternoon" = needs a focused block of time; "know-only" = knowledge, nothing to do.
- "skill_hint": short free-text English guess at the competency the item is about (e.g. "agentic tool use", "prompt caching", "MCP servers"), or null if there is no clear competency. This is NOT a canonical tag — just your best guess in plain words; a later step reconciles it against the controlled skill list.
- "experimental": true when the content is an impulse, experiment or "just tried this out" piece rather than something production-ready — independent of maturity.

Scoring rubrics (apply strictly):
- quality_score: 0-30 = marketing/hype/no substance; 40-60 = some substance, little concrete detail; 70-100 = concrete, technical, verifiable content.
- relevance_score: judge against the developer profile provided in the user message. 0-30 = outside their interests; 40-60 = peripheral; 70-100 = core interest.

Answer exclusively via the ${ENRICHMENT_TOOL_NAME} tool.`;

export interface EnrichmentInput {
  item: Pick<RawItem, "title" | "url" | "rawContent" | "publishedAt">;
  sourceName: Source["name"];
  profile: string;
  feedbackSummary?: string;
}

export function buildEnrichmentUserPrompt(input: EnrichmentInput): string {
  const parts = [
    "## Developer profile (relevance context)",
    input.profile.trim(),
  ];
  if (input.feedbackSummary) {
    parts.push("## Observed behavior (rolling feedback summary)", input.feedbackSummary.trim());
  }
  parts.push(
    "## Raw item",
    `Source: ${input.sourceName}`,
    `Title: ${input.item.title}`,
    `URL: ${input.item.url}`,
    `Published: ${input.item.publishedAt.toISOString()}`,
    "",
    "### Content",
    input.item.rawContent || "(no content beyond the title)",
  );
  return parts.join("\n");
}
