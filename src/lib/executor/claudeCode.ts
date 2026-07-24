import { spawn } from "node:child_process";
import type { StructuredCallOptions } from "@/lib/claude";

/**
 * The Claude-Code executor (Epic 17 / ADR 0015): performs structured inference
 * through the local `claude` CLI in headless mode, which spends the Claude Code
 * **subscription quota** instead of the paid API. It deliberately never imports
 * or touches the Anthropic SDK / `ANTHROPIC_API_KEY` — the zero-API guarantee of
 * the local profile. The caller zod-validates the returned object exactly like
 * the API path, preserving "null over hallucination" (ADR 0003).
 *
 * MVP shape: one CLI invocation per item (the same per-item seam as the API
 * executor). ADR 0015 targets an agent-batch + `emit_reel` tool for efficiency;
 * that is a later optimization (documented under Abweichungen in epic-17).
 */

/** Runs `claude` headless and returns its raw stdout. Injectable for tests. */
export type ClaudeCliRunner = (input: { prompt: string; model?: string }) => Promise<string>;

const defaultRunner: ClaudeCliRunner = ({ prompt, model }) =>
  new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json"];
    if (model) args.push("--model", model);
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim()}`)),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });

/** Builds the headless prompt: system + user + a strict JSON-only instruction. */
export function buildClaudeCodePrompt(opts: StructuredCallOptions): string {
  return [
    opts.system,
    "",
    opts.user,
    "",
    "Respond with EXACTLY one JSON object that matches this JSON schema:",
    JSON.stringify(opts.inputSchema),
    "Where the source does not support a value, use null instead of inventing. Output only the JSON — no other text, no code fences.",
  ].join("\n");
}

/** Extracts the structured object from the CLI's `--output-format json` output. */
export function extractResultJson(cliStdout: string): unknown {
  let envelope: unknown;
  try {
    envelope = JSON.parse(cliStdout);
  } catch {
    // Not a JSON envelope — fall back to parsing the raw stdout as the result.
    return parseLooseJson(cliStdout);
  }
  const result =
    envelope && typeof envelope === "object" && "result" in envelope
      ? (envelope as { result: unknown }).result
      : undefined;
  const text = typeof result === "string" ? result : cliStdout;
  return parseLooseJson(text);
}

/** Tolerant JSON extraction: strips code fences, else grabs the outer {...}. */
function parseLooseJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error("claude CLI result did not contain a JSON object");
  }
}

export async function claudeCodeExecutor(
  opts: StructuredCallOptions,
  runner: ClaudeCliRunner = defaultRunner,
): Promise<unknown> {
  const stdout = await runner({ prompt: buildClaudeCodePrompt(opts), model: opts.model });
  return extractResultJson(stdout);
}
