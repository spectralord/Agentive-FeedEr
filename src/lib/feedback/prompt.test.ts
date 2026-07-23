import { describe, expect, it } from "vitest";
import {
  buildFeedbackUserPrompt,
  FEEDBACK_SYSTEM_PROMPT,
  FEEDBACK_TOOL_NAME,
  feedbackSummarySchema,
} from "./prompt";

describe("feedback prompt", () => {
  it("system prompt requires the tool call and German mag/überspringt bullets", () => {
    expect(FEEDBACK_SYSTEM_PROMPT).toContain(FEEDBACK_TOOL_NAME);
    expect(FEEDBACK_SYSTEM_PROMPT).toContain("mag: …");
    expect(FEEDBACK_SYSTEM_PROMPT).toContain("überspringt: …");
  });

  it("user prompt lists each interaction with title/category/skill, newest first order preserved", () => {
    const prompt = buildFeedbackUserPrompt([
      { type: "save", createdAt: new Date("2026-07-23T10:00:00Z"), title: "Item A", category: "tooling", skill: "mcp-servers" },
      { type: "hide", createdAt: new Date("2026-07-22T10:00:00Z"), title: "Item B", category: "industry-news", skill: null },
    ]);

    expect(prompt).toContain("gespeichert");
    expect(prompt).toContain("Item A");
    expect(prompt).toContain("mcp-servers");
    expect(prompt).toContain("ausgeblendet");
    expect(prompt).toContain("Item B");
    expect(prompt).toContain("—"); // null skill rendered as em-dash
    expect(prompt.indexOf("Item A")).toBeLessThan(prompt.indexOf("Item B"));
  });
});

describe("feedbackSummarySchema", () => {
  it("accepts 5-8 bullets", () => {
    const bullets = Array.from({ length: 6 }, (_, i) => `bullet ${i}`);
    expect(feedbackSummarySchema.parse({ bullets })).toEqual({ bullets });
  });

  it("rejects fewer than 5 bullets", () => {
    expect(() => feedbackSummarySchema.parse({ bullets: ["only one"] })).toThrow();
  });

  it("rejects more than 8 bullets", () => {
    const bullets = Array.from({ length: 9 }, (_, i) => `bullet ${i}`);
    expect(() => feedbackSummarySchema.parse({ bullets })).toThrow();
  });
});
