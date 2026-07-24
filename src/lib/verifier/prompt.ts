export const VERIFIER_TOOL_NAME = "submit_verifier_check";

/**
 * The Stage-1 Reel-Verifier's "critic" role (ADR 0011, T10.2): a dedicated
 * second pass, separate from enrichment, whose only job is comparing an
 * already-written reel against its own source — never an external
 * fact-check, which would let the critic itself hallucinate (the core
 * problem ADR 0011 is designed around). Rule (A) Fidelity and rule (B)
 * Skepticism are both grounded in the provided source text only.
 */
export const VERIFIER_SYSTEM_PROMPT = `You are a skeptical critic comparing a short "reel" (an aggregated write-up: summary/example/action) against the original source text it was written from. You do NOT have external knowledge, web access, or the ability to fact-check against anything outside the provided source text.

Binding rules:
- Fidelity (A): Does the reel's summary, example, or action claim MORE than the source text actually supports? If so, return a short, factual caveat naming the specific gap (e.g. "Summary overclaims: source says X, not Y").
- Skepticism (B): Flag it if the reel repeats, uncritically, a risky claim type already present in the source — an unsupported benchmark/performance number, a superlative ("replaces X", "kills X", "best-in-class"), or a single case generalized into a general rule.
- Compare ONLY against the provided source text below — never invent a caveat from outside knowledge, and never invent one that isn't grounded in a specific mismatch or specific risky phrasing you can point to.
- When in doubt, or when the reel is a faithful and modestly-worded reflection of the source, return null for caveat. This is the normal, expected case — most reels should get null.
- If you do return a caveat, keep it to one short, factual sentence. It frames the claim for the reader; it does not discredit the reel or use an alarmist tone.
- Answer exclusively via the ${VERIFIER_TOOL_NAME} tool.`;

export interface VerifierSourceInput {
  title: string;
  url: string;
  rawContent: string;
}

export interface VerifierReelInput {
  summary: string;
  example: string | null;
  action: string | null;
}

export function buildVerifierUserPrompt(
  source: VerifierSourceInput,
  reel: VerifierReelInput,
): string {
  const lines = [
    "## Source",
    `Title: ${source.title}`,
    `URL: ${source.url}`,
    "",
    "### Source text",
    source.rawContent || "(no content beyond the title)",
    "",
    "## Reel (the write-up to check against the source above)",
    `Summary: ${reel.summary}`,
  ];
  if (reel.example) lines.push(`Example: ${reel.example}`);
  if (reel.action) lines.push(`Action: ${reel.action}`);
  return lines.join("\n");
}
