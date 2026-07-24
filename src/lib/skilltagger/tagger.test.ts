import { describe, expect, it, vi } from "vitest";
import { tagContent, type StructuredCaller } from "./tagger";
import { TAG_SYSTEM_PROMPT, TAG_TOOL_NAME, type ExistingSkillNode } from "./prompt";

const existingNodes: ExistingSkillNode[] = [
  { slug: "prompt-caching", title: "Prompt-Caching einsetzen", description: "Wiederverwendbare Prompt-Präfixe cachen." },
  { slug: "mcp-servers", title: "MCP-Server nutzen", description: "Model Context Protocol Server einbinden." },
];

describe("tagContent (mocked caller — no real API call)", () => {
  it("returns a match when the caller decides decision=match", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: "prompt-caching",
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });

    const result = await tagContent(
      { hint: "prompt caching", title: "Claude adds cache_control", text: "You can now cache prompt prefixes." },
      existingNodes,
      caller,
    );

    expect(result).toEqual({ match: "prompt-caching" });
    expect(caller).toHaveBeenCalledTimes(1);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toBe(TAG_SYSTEM_PROMPT);
    expect(call.toolName).toBe(TAG_TOOL_NAME);
    expect(call.user).toContain("prompt-caching");
    expect(call.user).toContain("Claude adds cache_control");
  });

  it("returns a proposal when the topic is unknown / doesn't fit any existing node", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "agentic-parallelization",
      propose_title: "Agenten parallelisieren",
      propose_theme: "parallelization",
      propose_description: "Mehrere Sub-Agenten gleichzeitig für Teilaufgaben einsetzen.",
    });

    const result = await tagContent(
      { hint: "parallel subagents", title: "Running 5 agents at once", text: "A new pattern for fanning out work across subagents." },
      existingNodes,
      caller,
    );

    expect(result).toEqual({
      propose: {
        slug: "agentic-parallelization",
        title: "Agenten parallelisieren",
        theme: "parallelization",
        description: "Mehrere Sub-Agenten gleichzeitig für Teilaufgaben einsetzen.",
      },
    });
  });

  it("rejects a malformed tool response (schema validation, no silent pass-through)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_slug: null, // inconsistent: match requires a slug
      propose_slug: null,
      propose_title: null,
      propose_theme: null,
      propose_description: null,
    });

    await expect(
      tagContent({ hint: null, title: "x", text: "y" }, existingNodes, caller),
    ).rejects.toThrow();
  });

  it("works with an empty existing-node list (propose-only)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_slug: null,
      propose_slug: "brand-new-topic",
      propose_title: "Brandneues Thema",
      propose_theme: "tooling",
      propose_description: "Beschreibung.",
    });

    const result = await tagContent({ hint: null, title: "x", text: "y" }, [], caller);
    expect(result).toEqual({
      propose: {
        slug: "brand-new-topic",
        title: "Brandneues Thema",
        theme: "tooling",
        description: "Beschreibung.",
      },
    });
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).toContain("(none yet)");
  });
});
