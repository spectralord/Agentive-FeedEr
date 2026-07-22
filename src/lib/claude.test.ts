import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { callStructured } from "./claude";

function mockClient(content: unknown[], stopReason = "tool_use") {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content, stop_reason: stopReason }),
    },
  } as unknown as Anthropic;
}

const baseOpts = {
  system: "sys",
  user: "usr",
  toolName: "submit",
  inputSchema: { type: "object" },
  model: "claude-test",
};

describe("callStructured", () => {
  it("returns the tool_use input", async () => {
    const client = mockClient([
      { type: "text", text: "thinking..." },
      { type: "tool_use", id: "t1", name: "submit", input: { a: 1 } },
    ]);
    const result = await callStructured({ ...baseOpts, client });
    expect(result).toEqual({ a: 1 });
  });

  it("forces tool_choice on the given tool", async () => {
    const client = mockClient([{ type: "tool_use", id: "t1", name: "submit", input: {} }]);
    await callStructured({ ...baseOpts, client });
    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: "tool", name: "submit" });
    expect(call.tools).toHaveLength(1);
    expect(call.model).toBe("claude-test");
  });

  it("throws when no tool_use block is returned", async () => {
    const client = mockClient([{ type: "text", text: "no tool" }], "end_turn");
    await expect(callStructured({ ...baseOpts, client })).rejects.toThrow(/tool_use/);
  });
});
