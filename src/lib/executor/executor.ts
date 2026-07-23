import { callStructured, type StructuredCallOptions } from "@/lib/claude";
import { claudeCodeExecutor } from "./claudeCode";
import type { ExecutionConfig } from "./config";

/**
 * An Executor performs one structured inference — the same seam as
 * `callStructured` (src/lib/claude.ts), so every LLM step (enrichment,
 * feedback summary, and later SkillTagger/clustering/knowledge-check) can be
 * driven by whichever executor the profile selects (ADR 0015, uniform executor).
 */
export type Executor = (opts: StructuredCallOptions) => Promise<unknown>;

/** Returns the executor for a resolved config. `claude-code` never touches the
 *  paid API; there is deliberately no silent API fallback (ADR 0015). */
export function getExecutor(config: ExecutionConfig): Executor {
  switch (config.executor) {
    case "api":
      return callStructured;
    case "claude-code":
      return claudeCodeExecutor;
  }
}
