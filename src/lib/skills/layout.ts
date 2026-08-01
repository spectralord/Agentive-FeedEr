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

/** A resolved point in the same abstract coordinate space as THEME_LAYOUT. */
export interface ResolvedPosition {
  x: number;
  y: number;
}

/** The minimal shape `resolveNodePosition` needs — a structural subset of
 *  `SkillNode` (`src/db/schema.ts`) rather than the full row, so callers
 *  (and tests) don't need a complete DB row just to resolve a point. */
export interface PositionableNode {
  slug: string;
  theme: Theme;
  positionX: number | null;
  positionY: number | null;
  positionLocked: boolean;
}

/**
 * A small, deterministic 32-bit string hash (FNV-1a). Deliberately hand
 * rolled rather than pulling in a hashing package — ADR 0020/T21.3 rule out
 * a new runtime dependency for what only needs to be stable, not
 * cryptographically strong. Pure function of the input string; same input
 * always produces the same output, in this process or any other.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime multiplication, done with shifts/adds to stay in 32-bit
    // integer arithmetic (JS bitwise ops truncate to 32 bits, so this
    // matches the standard FNV-1a reference algorithm exactly).
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0; // keep it an unsigned 32-bit integer between rounds
  }
  return hash >>> 0;
}

/**
 * Deterministic hash fallback tier (ADR 0020 decision 2/7): `slug` maps to
 * an (angle, radius) pair inside the node's theme circle, purely — no DB
 * read, no randomness, no Date/Math.random. The same slug always lands on
 * the exact same point, forever, in this process or any other, which is the
 * whole point: it guarantees every node has *some* stable position even
 * before any layout pass (stage b, explicitly out of scope this epic) has
 * ever run.
 *
 * Two independent hash values (the slug, and the slug with a suffix) drive
 * angle and radius separately so nodes don't all land at the same distance
 * from centre just because they got the same angle bucket by coincidence.
 * Radius is scaled to keep points away from the exact center (a cluster of
 * nodes all sitting on top of the centre dot would look wrong) and away
 * from the outer edge (so a node never renders as if it's escaping its
 * theme's circle at the boundary).
 */
function hashPositionInRegion(slug: string, region: ThemeRegion): ResolvedPosition {
  const angleHash = fnv1a(slug);
  const radiusHash = fnv1a(`${slug}:radius`);

  const angle = (angleHash / 0xffffffff) * 2 * Math.PI;
  // Keep the point within [15%, 85%] of the region's radius from its
  // centre — see rationale above.
  const radiusFraction = 0.15 + (radiusHash / 0xffffffff) * 0.7;
  const radius = region.r * radiusFraction;

  return {
    x: region.cx + radius * Math.cos(angle),
    y: region.cy + radius * Math.sin(angle),
  };
}

/**
 * Resolves a node's render position (ADR 0020 decision 2), in this
 * precedence order:
 *
 *   manual override (position_locked && x,y present)
 *     ?? stored computed layout (x,y present)
 *     ?? deterministic hash fallback
 *
 * The middle tier (a layout pass writing `position_x/y` without locking it)
 * has no producer yet — the incremental relaxation pass is stage (b),
 * explicitly out of scope for this epic (ADR 0020 decision 7) — but the
 * precedence is implemented now so stage (b) only ever needs to *write*
 * `skill_nodes` rows, never touch this function.
 */
export function resolveNodePosition(node: PositionableNode): ResolvedPosition {
  if (node.positionLocked && node.positionX !== null && node.positionY !== null) {
    return { x: node.positionX, y: node.positionY };
  }
  if (node.positionX !== null && node.positionY !== null) {
    return { x: node.positionX, y: node.positionY };
  }
  return hashPositionInRegion(node.slug, THEME_LAYOUT[node.theme]);
}
