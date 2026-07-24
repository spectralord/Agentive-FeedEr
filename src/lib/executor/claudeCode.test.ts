import { describe, expect, it, vi } from "vitest";
import { callStructured, type StructuredCallOptions } from "@/lib/claude";
import {
  buildClaudeCodePrompt,
  claudeCodeExecutor,
  extractResultJson,
  type ClaudeCliRunner,
} from "./claudeCode";
import { getExecutor } from "./executor";

const opts: StructuredCallOptions = {
  system: "SYSTEM-PROMPT",
  user: "USER-PROMPT",
  toolName: "emit_reel",
  inputSchema: { type: "object", properties: { summary: { type: "string" } } },
  model: "claude-haiku-4-5-20251001",
};

describe("buildClaudeCodePrompt", () => {
  it("includes system, user, the schema and a null-over-hallucination instruction", () => {
    const p = buildClaudeCodePrompt(opts);
    expect(p).toContain("SYSTEM-PROMPT");
    expect(p).toContain("USER-PROMPT");
    expect(p).toContain('"summary"');
    expect(p).toMatch(/use null instead of inventing/);
  });
});

describe("extractResultJson", () => {
  it("parses the CLI json envelope whose result is a JSON string", () => {
    const envelope = JSON.stringify({ type: "result", result: '{"summary":"hi"}' });
    expect(extractResultJson(envelope)).toEqual({ summary: "hi" });
  });

  it("parses a fenced JSON result", () => {
    const envelope = JSON.stringify({ result: "```json\n{\"summary\":\"x\"}\n```" });
    expect(extractResultJson(envelope)).toEqual({ summary: "x" });
  });

  it("grabs an embedded object when the result has surrounding prose", () => {
    const envelope = JSON.stringify({ result: 'Hier: {"summary":"y"} fertig.' });
    expect(extractResultJson(envelope)).toEqual({ summary: "y" });
  });

  it("falls back to raw stdout when it is not an envelope", () => {
    expect(extractResultJson('{"summary":"z"}')).toEqual({ summary: "z" });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractResultJson(JSON.stringify({ result: "no json here" }))).toThrow(
      /did not contain a JSON object/,
    );
  });
});

describe("claudeCodeExecutor", () => {
  it("runs the CLI runner with the built prompt + model and returns the parsed object", async () => {
    const runner = vi.fn<ClaudeCliRunner>(async () =>
      JSON.stringify({ result: '{"summary":"done"}' }),
    );
    const result = await claudeCodeExecutor(opts, runner);
    expect(result).toEqual({ summary: "done" });
    expect(runner).toHaveBeenCalledOnce();
    const call = runner.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5-20251001");
    expect(call.prompt).toContain("USER-PROMPT");
  });

  it("propagates runner failures (no silent fallback)", async () => {
    const runner: ClaudeCliRunner = async () => {
      throw new Error("claude CLI exited with code 1");
    };
    await expect(claudeCodeExecutor(opts, runner)).rejects.toThrow(/claude CLI exited/);
  });
});

describe("getExecutor factory", () => {
  it("returns the API caller for executor=api", () => {
    expect(getExecutor({ profile: "cloud", executor: "api", trigger: "railway-cron" })).toBe(
      callStructured,
    );
  });

  it("returns the Claude Code executor for executor=claude-code", () => {
    expect(
      getExecutor({ profile: "local", executor: "claude-code", trigger: "manual" }),
    ).toBe(claudeCodeExecutor);
  });
});
