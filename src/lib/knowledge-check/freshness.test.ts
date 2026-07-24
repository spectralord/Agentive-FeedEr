import { describe, expect, it, vi } from "vitest";
import {
  compareCandidateGroup,
  FRESHNESS_SYSTEM_PROMPT,
  FRESHNESS_TOOL_NAME,
  type FreshnessCandidateGroup,
  type StructuredCaller,
} from "./freshness";

const group: FreshnessCandidateGroup = {
  skill: "claude-code-cli",
  clusters: [
    {
      id: 1,
      title: "Claude Code batch command",
      members: [{ title: "Batch command announced", summary: "Introduces the batch flag for parallel runs." }],
    },
    {
      id: 2,
      title: "Claude Code fork command",
      members: [
        {
          title: "Fork command replaces batch",
          summary: "The changelog states the fork command replaces the now-deprecated batch flag.",
        },
      ],
    },
  ],
};

describe("compareCandidateGroup (mocked caller — no real API call)", () => {
  it("clear supersession: fields are set from the model's grounded output", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: 1,
      superseded_by_cluster_id: 2,
      reason: "Changelog states the fork command replaces the deprecated batch flag.",
    });

    const result = await compareCandidateGroup(group, caller);

    expect(result).toEqual({
      supersededClusterId: 1,
      supersededByClusterId: 2,
      reason: "Changelog states the fork command replaces the deprecated batch flag.",
    });
    expect(caller).toHaveBeenCalledTimes(1);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toBe(FRESHNESS_SYSTEM_PROMPT);
    expect(call.toolName).toBe(FRESHNESS_TOOL_NAME);
    expect(call.user).toContain("Claude Code batch command");
    expect(call.user).toContain("Claude Code fork command");
  });

  it("unrelated/unclear topics: all-null result, no-op", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    const result = await compareCandidateGroup(group, caller);

    expect(result).toEqual({ supersededClusterId: null, supersededByClusterId: null, reason: null });
  });

  it("rejects a malformed tool response (schema validation, no silent pass-through)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: 1,
      superseded_by_cluster_id: null, // inconsistent: must both be null or both set
      reason: null,
    });

    await expect(compareCandidateGroup(group, caller)).rejects.toThrow();
  });

  it("rejects a cluster claiming to supersede itself", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: 1,
      superseded_by_cluster_id: 1,
      reason: "not really a reason",
    });

    await expect(compareCandidateGroup(group, caller)).rejects.toThrow();
  });

  it("passes KNOWLEDGE_CHECK_MODEL/ANTHROPIC_MODEL fallback through as the model option", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      superseded_cluster_id: null,
      superseded_by_cluster_id: null,
      reason: null,
    });

    await compareCandidateGroup(group, caller);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof call.model).toBe("string");
    expect(call.model.length).toBeGreaterThan(0);
  });
});
