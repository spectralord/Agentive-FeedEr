import { describe, expect, it } from "vitest";
import { loadProfile } from "./profile";
import { buildEnrichmentUserPrompt, ENRICHMENT_SYSTEM_PROMPT } from "./prompt";
import { reelOutputSchema } from "./schema";

const validOutput = {
  summary: "Claude Code unterstützt jetzt Subagenten. Das erlaubt parallele Arbeit.",
  category: "claude-feature",
  maturity: "emerging",
  experimental: false,
  relevance_score: 85,
  quality_score: 75,
  example: "claude --agent sonnet 'run tests'",
  action: "Probier Subagenten für parallele Test-Läufe aus.",
  effort_tag: "5-min-test",
  skill: "agentic-tool-use",
};

describe("reelOutputSchema", () => {
  it("accepts a valid full object", () => {
    expect(reelOutputSchema.parse(validOutput)).toEqual(validOutput);
  });

  it("accepts nullables as null (sourced-only fallback)", () => {
    const minimal = { ...validOutput, example: null, action: null, effort_tag: null, skill: null };
    expect(reelOutputSchema.parse(minimal).action).toBeNull();
  });

  it("rejects out-of-range scores", () => {
    expect(() => reelOutputSchema.parse({ ...validOutput, relevance_score: 101 })).toThrow();
  });

  it("rejects effort_tag without action", () => {
    expect(() =>
      reelOutputSchema.parse({ ...validOutput, action: null, effort_tag: "5-min-test" }),
    ).toThrow(/effort_tag/);
  });

  it("rejects non-kebab-case skill slugs", () => {
    expect(() => reelOutputSchema.parse({ ...validOutput, skill: "Agentic Tool Use" })).toThrow();
  });
});

describe("prompt", () => {
  it("system prompt carries the binding rules", () => {
    expect(ENRICHMENT_SYSTEM_PROMPT).toContain("SOURCED-ONLY");
    expect(ENRICHMENT_SYSTEM_PROMPT).toContain("quality_score: 0-30");
    expect(ENRICHMENT_SYSTEM_PROMPT).toContain("submit_reel");
  });

  it("user prompt contains profile and item, matches snapshot", () => {
    const prompt = buildEnrichmentUserPrompt({
      item: {
        title: "New agent SDK",
        url: "https://example.com/sdk",
        rawContent: "The SDK now supports tools.",
        publishedAt: new Date("2026-07-20T08:00:00Z"),
      },
      sourceName: "simon-willison",
      profile: "# Profil\nTypeScript-Entwickler.",
    });
    expect(prompt).toMatchSnapshot();
  });

  it("appends the rolling feedback summary as extra context when provided (T6.4)", () => {
    const prompt = buildEnrichmentUserPrompt({
      item: {
        title: "New agent SDK",
        url: "https://example.com/sdk",
        rawContent: "The SDK now supports tools.",
        publishedAt: new Date("2026-07-20T08:00:00Z"),
      },
      sourceName: "simon-willison",
      profile: "# Profil\nTypeScript-Entwickler.",
      feedbackSummary: "- mag: konkrete Beispiele\n- überspringt: reine Ankündigungen",
    });

    expect(prompt).toContain("## Observed behavior (rolling feedback summary)");
    expect(prompt).toContain("mag: konkrete Beispiele");
    // Comes right after the profile, before the raw item.
    expect(prompt.indexOf("Observed behavior")).toBeGreaterThan(prompt.indexOf("Developer profile"));
    expect(prompt.indexOf("Observed behavior")).toBeLessThan(prompt.indexOf("Raw item"));
  });

  it("omits the feedback-summary section entirely when none is available", () => {
    const prompt = buildEnrichmentUserPrompt({
      item: {
        title: "New agent SDK",
        url: "https://example.com/sdk",
        rawContent: "The SDK now supports tools.",
        publishedAt: new Date("2026-07-20T08:00:00Z"),
      },
      sourceName: "simon-willison",
      profile: "# Profil\nTypeScript-Entwickler.",
    });

    expect(prompt).not.toContain("Observed behavior");
  });
});

describe("loadProfile", () => {
  it("loads the repo profile.md", () => {
    expect(loadProfile()).toContain("Developer-Profil");
  });

  it("throws a readable error when missing", () => {
    expect(() => loadProfile("/nonexistent")).toThrow(/profile\.md not found/);
  });
});
