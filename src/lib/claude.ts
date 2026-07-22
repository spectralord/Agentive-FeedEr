import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

const globalForClaude = globalThis as unknown as { __anthropicClient?: Anthropic };

export function anthropicClient(): Anthropic {
  globalForClaude.__anthropicClient ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return globalForClaude.__anthropicClient;
}

export interface StructuredCallOptions {
  system: string;
  user: string;
  toolName: string;
  /** JSON schema describing the expected tool input (= the structured output). */
  inputSchema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  client?: Anthropic;
}

/**
 * Forces the model to answer via a single tool call and returns the tool input.
 * Callers validate the result (e.g. with zod) — this function only guarantees
 * that *some* tool_use block came back.
 */
export async function callStructured(opts: StructuredCallOptions): Promise<unknown> {
  const client = opts.client ?? anthropicClient();
  const response = await client.messages.create({
    model: opts.model ?? env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description: "Submit the structured result.",
        input_schema: opts.inputSchema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Expected a tool_use block from model, got: ${response.stop_reason}`);
  }
  return toolUse.input;
}
