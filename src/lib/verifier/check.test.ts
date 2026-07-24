import { describe, expect, it, vi } from "vitest";
import { checkReel, type StructuredCaller } from "./run";
import { VERIFIER_SYSTEM_PROMPT, VERIFIER_TOOL_NAME } from "./prompt";

const source = {
  title: "New parser released",
  url: "https://example.com/parser",
  rawContent: "The new parser is 12% faster on our internal micro-benchmark for one specific input file.",
};

describe("checkReel (mocked caller — no real API call)", () => {
  it("returns a caveat when the reel overclaims relative to the source", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({
      caveat: "Summary overclaims: source says 12% faster on one micro-benchmark, not universally faster.",
    });

    const result = await checkReel(
      source,
      { summary: "The new parser is universally faster than anything else.", example: null, action: null },
      caller,
    );

    expect(result).toEqual({
      caveat: "Summary overclaims: source says 12% faster on one micro-benchmark, not universally faster.",
    });
    expect(caller).toHaveBeenCalledTimes(1);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toBe(VERIFIER_SYSTEM_PROMPT);
    expect(call.toolName).toBe(VERIFIER_TOOL_NAME);
    expect(call.user).toContain("New parser released");
    expect(call.user).toContain("micro-benchmark");
  });

  it("returns null for a faithful reel (the normal case)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ caveat: null });

    const result = await checkReel(
      source,
      { summary: "The new parser is 12% faster on an internal micro-benchmark for one input file.", example: null, action: null },
      caller,
    );

    expect(result).toEqual({ caveat: null });
  });

  it("includes example/action in the prompt when present", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ caveat: null });

    await checkReel(
      source,
      { summary: "Faithful summary.", example: "example snippet", action: "try this action" },
      caller,
    );

    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.user).toContain("example snippet");
    expect(call.user).toContain("try this action");
  });

  it("rejects a malformed tool response (schema validation, no silent pass-through)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ caveat: "" }); // empty string violates min(1)

    await expect(
      checkReel(source, { summary: "x", example: null, action: null }, caller),
    ).rejects.toThrow();
  });
});
