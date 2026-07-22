import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Reads the developer profile used as relevance context (repo root: profile.md). */
export function loadProfile(baseDir: string = process.cwd()): string {
  const path = join(baseDir, "profile.md");
  try {
    return readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `profile.md not found at ${path} — it is required as relevance context for enrichment (see docs/plan/epic-2-enrichment.md T2.2).`,
    );
  }
}
