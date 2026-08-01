import { describe, expect, it, vi } from "vitest";
import { generateWriteup, type StructuredCaller } from "./run";
import { WRITEUP_SYSTEM_PROMPT, WRITEUP_TOOL_NAME } from "./prompt";

const source = {
  title: "New parser released",
  sourceName: "Example Blog",
  rawContent:
    "The new parser is 12% faster on our internal micro-benchmark for one specific input file. It replaces a hand-written recursive descent parser with a generated one.",
};

describe("generateWriteup (mocked caller — no real API call, ADR 0015)", () => {
  it("sends the built prompt to the caller", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ writeup: "Some prose about the parser." });

    await generateWriteup(source, { summary: "Faster parser released." }, caller);

    expect(caller).toHaveBeenCalledTimes(1);
    const call = (caller as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toBe(WRITEUP_SYSTEM_PROMPT);
    expect(call.toolName).toBe(WRITEUP_TOOL_NAME);
    expect(call.user).toContain("New parser released");
    expect(call.user).toContain("Example Blog");
    expect(call.user).toContain("micro-benchmark");
    expect(call.user).toContain("Faster parser released.");
  });

  it("parses a valid non-null response", async () => {
    const caller: StructuredCaller = vi
      .fn()
      .mockResolvedValue({ writeup: "A few paragraphs of honest prose about the parser." });

    const result = await generateWriteup(source, { summary: "Faster parser released." }, caller);

    expect(result).toEqual({ writeup: "A few paragraphs of honest prose about the parser." });
  });

  it("rejects a schema-invalid response (no silent pass-through, ADR 0003)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ writeup: "" }); // empty string violates min(1)

    await expect(
      generateWriteup(source, { summary: "Faster parser released." }, caller),
    ).rejects.toThrow();
  });

  it("rejects a response missing the writeup field entirely", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({});

    await expect(
      generateWriteup(source, { summary: "Faster parser released." }, caller),
    ).rejects.toThrow();
  });

  it("returns null when the source content is too thin to honestly elaborate on (ADR 0003)", async () => {
    const caller: StructuredCaller = vi.fn().mockResolvedValue({ writeup: null });

    const result = await generateWriteup(source, { summary: "Faster parser released." }, caller);

    expect(result).toEqual({ writeup: null });
  });
});
