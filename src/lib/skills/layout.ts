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

// The golden angle (radians) — the standard constant behind Fibonacci/
// sunflower spirals (Vogel's model), chosen because consecutive points are
// maximally spread rather than drifting into rings or spokes the way a
// naive `angle = i / n * 2π` grid does.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Target minimum centre-to-centre spacing between two hash-tier points in
// the same theme, in the same abstract units as THEME_LAYOUT — chosen so
// that after the renderer scales the 1000-unit square down to a real
// viewport, two 36px SkillRings (T21.4's node size) plus their labels don't
// visually touch. Drives HASH_SLOT_COUNT below; see that constant's comment
// for why this can only be a target, not a guarantee, at high node counts.
const TARGET_MIN_SPACING = 45;

/**
 * Per-region slot count for the sunflower spiral (see `hashPositionInRegion`),
 * sized so consecutive slots stay >= TARGET_MIN_SPACING apart even at the
 * spiral's outer edge (its most sparsely-populated ring). Proportional to
 * region.r because a small region (e.g. `industry`, r=90) fits fewer
 * comfortably-spaced points than a large one (`agents`, r=150) — a single
 * global slot count sized for the biggest region would crowd the smallest
 * one, and one sized for the smallest would under-use the biggest.
 *
 * This is a target, not an absolute guarantee: two *different* slugs always
 * land on different points as long as they hash to different slots (the
 * spiral's geometry keeps distinct slots apart by construction), but a
 * theme holding more nodes than it has slots will see hash collisions —
 * the point at which ADR 0020's open question about per-theme overflow
 * (grow the radius, add a ring, cap and paginate) needs an answer anyway,
 * not something this hash tier can or should paper over on its own.
 */
function hashSlotCount(region: ThemeRegion): number {
  // Solving TARGET_MIN_SPACING ~= 2π * r_outer / n for n, where r_outer is
  // the spiral's outer radius (region.r * 0.85, matching the 0.85 factor in
  // hashPositionInRegion below) — i.e. treat the outermost ring as a plain
  // circle and ask how many TARGET_MIN_SPACING-wide arcs fit around it.
  const outerRadius = region.r * 0.85;
  const slots = Math.floor((2 * Math.PI * outerRadius) / TARGET_MIN_SPACING);
  return Math.max(slots, 6); // never so few that the fallback feels broken
}

/**
 * Deterministic hash fallback tier (ADR 0020 decision 2/7): `slug` maps to
 * a point inside the node's theme circle, purely — no DB read, no
 * randomness, no Date/Math.random. The same slug always lands on the exact
 * same point, forever, in this process or any other, which is the whole
 * point: it guarantees every node has *some* stable position even before
 * any layout pass (stage b, explicitly out of scope this epic) has ever
 * run.
 *
 * Naive polar hashing (independent random angle + radius per slug) was
 * tried and rejected here: with few nodes sharing a theme, nothing stops
 * two unrelated slugs from hashing to nearby angles *and* nearby radii,
 * producing visually overlapping nodes purely by chance — measured directly
 * against this project's seed data (`agentic-tool-use`, `mcp-servers`,
 * `computer-use`, all theme `agents`, landed within ~60 units of each other
 * in the 1000-unit space, close enough for their rendered rings/labels to
 * collide). A **sunflower/Fibonacci spiral lattice** fixes this
 * structurally: `slug` hashes to one of a fixed number of slots
 * (`hashSlotCount`, Vogel's model, using the golden angle), and any two
 * *different* slots are guaranteed apart from each other by the spiral's
 * geometry — a collision can only happen if two slugs hash to the *same*
 * slot.
 */
function hashPositionInRegion(slug: string, region: ThemeRegion): ResolvedPosition {
  const slotCount = hashSlotCount(region);
  const slot = fnv1a(slug) % slotCount;

  // Vogel's sunflower model: point i sits at radius sqrt(i / n) (so density
  // stays even from centre to edge, rather than the outer ring being
  // sparser) and angle i * goldenAngle. max(slot, 0.5) keeps slot 0 off
  // dead-centre, matching how every other slot is offset. The 0.85 factor
  // (rather than closer to 1) keeps every point comfortably inside the
  // circle, not grazing its boundary — and matches the outer-radius
  // assumption `hashSlotCount` solves against.
  const fraction = Math.max(slot, 0.5) / slotCount;
  const radius = region.r * 0.85 * Math.sqrt(fraction);
  const angle = slot * GOLDEN_ANGLE;

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
