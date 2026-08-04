import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Common German function words. Used only to catch a non-English profile — see
 * `assertEnglishProfile`. Deliberately words with no English homograph, so an
 * English profile mentioning e.g. "die" (as in "die cast") cannot trip it.
 */
const GERMAN_MARKERS = [
  "und",
  "nicht",
  "werden",
  "wurde",
  "über",
  "für",
  "durch",
  "sich",
  "eine",
  "beim",
];

/**
 * Guards against the failure that cost a full corpus on 2026-08-03: `profile.md`
 * was written in German, and because it is injected as the FIRST section of every
 * enrichment prompt, the model mirrored its language and produced German
 * summaries for ~100 Reels — despite the system prompt asking for English three
 * separate times.
 *
 * The damage is silent (nothing crashes; the output is just in the wrong
 * language) and multiplies by the batch size, so it is worth failing loudly at
 * load time instead. English everywhere is a project convention, not a
 * preference (`docs/plan/README.md` §2).
 */
export function assertEnglishProfile(content: string): void {
  const words = content.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 20) return; // too short to judge

  const hits = words.filter((w) => GERMAN_MARKERS.includes(w)).length;
  if (hits / words.length > 0.04) {
    throw new Error(
      "profile.md looks like it is not written in English " +
        `(${hits} German function words in ${words.length}). It is injected as the first ` +
        "section of every enrichment prompt, so the model mirrors its language and will " +
        "produce non-English summaries for every item — which happened on 2026-08-03. " +
        "Translate profile.md to English (docs/plan/README.md §2: English everywhere).",
    );
  }
}

/** Reads the developer profile used as relevance context (repo root: profile.md). */
export function loadProfile(baseDir: string = process.cwd()): string {
  const path = join(baseDir, "profile.md");
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `profile.md not found at ${path} — it is required as relevance context for enrichment (see docs/plan/epic-2-enrichment.md T2.2).`,
    );
  }
  assertEnglishProfile(content);
  return content;
}
