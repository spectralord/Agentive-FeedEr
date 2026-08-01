import type { Theme } from "@/lib/skills";

/** A theme region: a circle in an abstract 0–1000 coordinate space. The
 *  renderer scales this square to whatever viewport it draws into. */
export interface ThemeRegion {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Hand-placed theme regions (Epic 21, T21.2 / ADR 0020 decisions 1 & 6):
 * one circle per `THEMES` slug, laid out deliberately so related themes sit
 * next to each other, in an abstract 0–1000 square. A code constant, not a
 * DB row — same "structural constants live in code" convention as `THEMES`
 * itself and `SOURCE_REGISTRY` (`src/lib/sources.ts`): themes change rarely
 * and deliberately, and their arrangement is a design choice, not derived
 * data (ADR 0020 decision 1).
 *
 * Layout intent — two loose clusters plus one outlier, not a mechanical
 * grid:
 *   - **Agentic cluster** (left/bottom-left): `agents` is the hub, with
 *     `parallelization` (orchestration/sub-agents — an agents sub-topic)
 *     and `integration` (MCP/protocols — how agents reach tools) adjacent
 *     to it. `tooling` (concrete SDKs/CLIs) bridges this cluster and the
 *     model cluster below, sitting between `agents` and `prompting`/`models`.
 *   - **Model/knowledge cluster** (right): `prompting` (construction/context)
 *     and `models` (capabilities/releases) sit next to each other, with
 *     `evaluation` (benchmarking model output) adjacent to `models`.
 *   - **Industry** (top-right corner, deliberately distant from both
 *     clusters): trends/adoption/non-technical context — the one theme
 *     that isn't "how to build with Claude", so it doesn't crowd either
 *     technical cluster.
 *
 * Radii are roughly proportional to expected node-count headroom, not
 * current node count (current counts are tiny — see ADR 0020's "one
 * co-occurring pair in the whole corpus" — sizing for today's four nodes
 * would make this unusable the moment ten more show up).
 */
export const THEME_LAYOUT: Record<Theme, ThemeRegion> = {
  agents: { cx: 280, cy: 400, r: 150 },
  parallelization: { cx: 130, cy: 150, r: 100 },
  integration: { cx: 300, cy: 680, r: 110 },
  tooling: { cx: 540, cy: 520, r: 120 },
  prompting: { cx: 650, cy: 250, r: 120 },
  models: { cx: 860, cy: 430, r: 130 },
  evaluation: { cx: 800, cy: 700, r: 100 },
  industry: { cx: 900, cy: 130, r: 90 },
};

/** The abstract coordinate space THEME_LAYOUT is defined in — both axes,
 *  since it's a square. Exported so the renderer/tests don't hardcode 1000
 *  a second time. */
export const LAYOUT_SPACE_SIZE = 1000;
