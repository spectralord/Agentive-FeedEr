/**
 * Fixed theme taxonomy for skill nodes (Epic 12, T12.3). Themes group nodes for
 * display and give the SkillTagger a bounded vocabulary for the `theme` field
 * when proposing a new node — this is the authoritative definition until
 * Epic 7 (Skill-Map) takes it over.
 *
 * English slugs (code/data convention); kept short and few (6-10) on purpose —
 * this is a coarse grouping axis, not the taxonomy itself (that's the growing
 * set of skill_nodes rows).
 */
export const THEMES = [
  // Running multiple agents/tasks concurrently, orchestration, sub-agents.
  "parallelization",
  // Agent design/behavior: tool use, planning, autonomy, multi-step workflows.
  "agents",
  // Concrete tools/products/SDKs/CLIs in the ecosystem.
  "tooling",
  // Prompt construction, prompt caching, context engineering.
  "prompting",
  // Evaluation, benchmarking, quality/verification of model output.
  "evaluation",
  // Model capabilities/releases/research findings themselves.
  "models",
  // Integration/protocols connecting models to external systems (e.g. MCP).
  "integration",
  // Industry/product trends, adoption, non-technical context.
  "industry",
] as const;

export type Theme = (typeof THEMES)[number];
