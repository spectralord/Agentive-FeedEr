import { describe, expect, it } from "vitest";
import { assertEnglishProfile } from "./profile";

/**
 * Regression guard for 2026-08-03: `profile.md` was written in German, and because
 * it is injected as the FIRST section of every enrichment prompt, the model
 * mirrored its language and produced German summaries for ~100 Reels — despite the
 * system prompt asking for English three separate times.
 *
 * The failure was silent (nothing crashed) and multiplied by the batch size, which
 * is exactly the shape of bug worth a cheap guard at load time.
 */
describe("assertEnglishProfile", () => {
  it("accepts the real English profile shape", () => {
    expect(() =>
      assertEnglishProfile(`# Developer profile
## Stack & tools
TypeScript, React/Next.js, Node; Claude Code (web/CLI); GitHub.
## Role & level
Experienced developer; leads and mentors team colleagues.
## Interests (highly relevant)
New Claude features; agentic workflows in development; MCP; prompt and context engineering.
## Low relevance
Pure ML research and mathematics; non-developer AI news (art, consumer apps); crypto.
## What annoys me
Marketing hype without substance; clickbait; "top 10 tools" listicles.`),
    ).not.toThrow();
  });

  it("rejects the German profile that caused the incident", () => {
    expect(() =>
      assertEnglishProfile(`# Developer-Profil
Dieses Profil ist der Relevanz-Kontext für die KI-Aufbereitung.
Es wird bei jedem Enrichment-Lauf mitgegeben und kann jederzeit editiert werden.
## Rolle & Level
Erfahrener Entwickler; führt und mentort Team-Kollegen durch neue Themen.
## Wenig relevant
Reine ML-Forschung; Non-Dev-KI-News; diese werden nicht durch mich beim Lesen verfolgt.`),
    ).toThrow(/not written in English/);
  });

  it("does not judge a profile too short to be meaningful", () => {
    expect(() => assertEnglishProfile("# Profile\nTypeScript und Node")).not.toThrow();
  });

  it("tolerates English text containing words that look German in isolation", () => {
    // "die" (die cast), "sich" absent — the marker list deliberately avoids
    // English homographs so a legitimate profile cannot trip the guard.
    expect(() =>
      assertEnglishProfile(`# Developer profile
I work on build tooling and die-cast configuration generators for Node services.
My interests are agentic workflows, prompt engineering, and practical best practices
for AI-assisted development across TypeScript and React codebases everywhere.`),
    ).not.toThrow();
  });
});
