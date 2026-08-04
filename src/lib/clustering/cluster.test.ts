import { describe, expect, it, vi } from "vitest";
import { assignCluster, type StructuredCaller } from "./cluster";
import { CLUSTER_SYSTEM_PROMPT, CLUSTER_TOOL_NAME, type CandidateCluster } from "./prompt";

const candidates: CandidateCluster[] = [
  { id: 1, title: "Claude Code batch command", memberSourceNames: ["anthropic-blog"] },
  { id: 2, title: "MCP server registry launch", memberSourceNames: ["anthropic-blog", "hn"] },
];

describe("assignCluster (mocked caller — no real API call)", () => {
  it("(a) returns a match when the reel fits an existing cluster", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: 1,
      propose_title: null,
      is_primary: true,
    });

    const result = await assignCluster(
      { title: "More on the batch command", summary: "A deep dive into the same batch command.", sourceName: "some-blog" },
      candidates,
      caller,
    );

    expect(result).toEqual({ match: { clusterId: 1, isPrimary: true } });
    expect(caller).toHaveBeenCalledTimes(1);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toBe(CLUSTER_SYSTEM_PROMPT);
    expect(call.toolName).toBe(CLUSTER_TOOL_NAME);
    expect(call.user).toContain("Claude Code batch command");
    expect(call.user).toContain("some-blog");
  });

  it("(b) returns a proposal when the topic doesn't fit any existing cluster", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_cluster_id: null,
      propose_title: "New parallel subagent pattern",
      is_primary: true,
    });

    const result = await assignCluster(
      { title: "Running 5 agents at once", summary: "A brand-new pattern for fanning out work.", sourceName: "some-blog" },
      candidates,
      caller,
    );

    expect(result).toEqual({ propose: { title: "New parallel subagent pattern" } });
  });

  it("(c) a reblog of an existing cluster member yields is_primary=false", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: 2,
      propose_title: null,
      is_primary: false,
    });

    const result = await assignCluster(
      { title: "MCP registry, as reported by anthropic-blog", summary: "Recaps the anthropic-blog announcement, no independent testing.", sourceName: "aggregator-site" },
      candidates,
      caller,
    );

    expect(result).toEqual({ match: { clusterId: 2, isPrimary: false } });
  });

  it("ignores the model's is_primary judgement on propose — first member is primary by definition (ADR 0013)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_cluster_id: null,
      propose_title: "Brand new topic",
      is_primary: false, // model returned false, but propose has no result.propose.isPrimary field at all
    });

    const result = await assignCluster({ title: "x", summary: "y", sourceName: "z" }, [], caller);
    expect(result).toEqual({ propose: { title: "Brand new topic" } });
    expect(Object.keys((result as { propose: object }).propose)).toEqual(["title"]);
  });

  it("accepts a null is_primary on propose — the prompt says it is ignored there (real-corpus regression, 2026-08-03)", async () => {
    // The field's own description tells the model "Ignored when decision=propose".
    // On the real corpus the model took that at its word and returned null, which
    // a z.boolean() rejected — failing the whole item with a ZodError even though
    // the value is discarded in this branch.
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_cluster_id: null,
      propose_title: "Brand new topic",
      is_primary: null,
    });

    const result = await assignCluster({ title: "x", summary: "y", sourceName: "z" }, [], caller);
    expect(result).toEqual({ propose: { title: "Brand new topic" } });
  });

  it("defaults a null is_primary to true on match (ADR 0013 'when in doubt, true')", async () => {
    // Never let null read as false: that would understate corroboration on a
    // deliberately coarse few/some/strong scale.
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: 7,
      propose_title: null,
      is_primary: null,
    });

    const result = await assignCluster({ title: "x", summary: "y", sourceName: "z" }, [], caller);
    expect(result).toEqual({ match: { clusterId: 7, isPrimary: true } });
  });

  it("rejects a malformed tool response (schema validation, no silent pass-through)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "match",
      match_cluster_id: null, // inconsistent: match requires a cluster id
      propose_title: null,
      is_primary: true,
    });

    await expect(
      assignCluster({ title: "x", summary: "y", sourceName: "z" }, candidates, caller),
    ).rejects.toThrow();
  });

  it("works with an empty candidate list (propose-only)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      decision: "propose",
      match_cluster_id: null,
      propose_title: "Brand new topic",
      is_primary: true,
    });

    const result = await assignCluster({ title: "x", summary: "y", sourceName: "z" }, [], caller);
    expect(result).toEqual({ propose: { title: "Brand new topic" } });
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).toContain("(none yet)");
  });
});
