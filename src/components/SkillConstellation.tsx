"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { THEME_LABELS, THEMES } from "@/lib/skills";
import { LAYOUT_SPACE_SIZE, THEME_LAYOUT } from "@/lib/skills/layout";
import type { SkillMapNode, SkillMapTheme } from "@/lib/skills/map";
import { SkillRing } from "./SkillRing";

const NODE_RING_SIZE = 28;

/** Minimum horizontal separation (in the same abstract 0-1000 units as
 *  `resolveNodePosition`) below which two node labels are considered close
 *  enough to potentially overlap at a narrow viewport — see
 *  `assignLabelRows` below. Tuned against this project's actual seed data
 *  (three `agents`-theme nodes hash to within this range of each other at
 *  375px) rather than derived from a formula — the real constraint is "does
 *  it look right in the screenshot", checked directly. */
const LABEL_COLLISION_DISTANCE = 130;

interface PositionedNode extends SkillMapNode {
  /** Which stacked row (0, 1, 2, ...) this node's label renders in below its
   *  ring. 0 is the normal position immediately under the ring; every row
   *  after that pushes the label further down so it clears any
   *  horizontally-close neighbour's label instead of overlapping it. */
  labelRow: number;
}

/**
 * Deterministic label-collision avoidance — NOT a node layout pass (ADR
 * 0020 decision 7 bans that; ADR 0020 decision 2's positions are untouched
 * here). This only decides which vertical row a label's *text* renders in
 * below its ring; it never moves a ring/node. Standard cartographic label
 * placement: when two anchors are close enough that their labels would
 * collide, stack the labels instead of letting them overlap. Pure function
 * of the already-resolved positions — same input, same output, every time,
 * same as everything else in this module.
 *
 * O(n^2) over nodes *within a single render pass*, which is fine at every
 * node count this app has ever seen (a handful of nodes per theme) — this
 * is not a persisted computation, and it's recomputed from scratch on
 * every render exactly like the rest of this component.
 */
function assignLabelRows(nodes: SkillMapNode[]): PositionedNode[] {
  const placed: PositionedNode[] = [];
  for (const node of nodes) {
    let row = 0;
    // Look at every already-placed node that's horizontally close enough
    // for its label to reach into this node's column, and make sure this
    // node's row differs from all of theirs.
    const nearbyRows = new Set(
      placed
        .filter((other) => Math.abs(other.position.x - node.position.x) < LABEL_COLLISION_DISTANCE)
        .map((other) => other.labelRow),
    );
    while (nearbyRows.has(row)) row++;
    placed.push({ ...node, labelRow: row });
  }
  return placed;
}

/** Clamp a coordinate into the abstract 0-LAYOUT_SPACE_SIZE square — the
 *  drag handler computes a pointer position that could in principle land
 *  just outside it (e.g. a drag released a pixel past the container edge),
 *  and the API route validates independently anyway, but clamping here
 *  keeps the dragged node visually inside the box instead of momentarily
 *  rendering off it before the request resolves. */
function clamp(value: number): number {
  return Math.min(LAYOUT_SPACE_SIZE, Math.max(0, value));
}

async function postPosition(slug: string, body: { x: number; y: number } | { reset: true }): Promise<boolean> {
  try {
    const res = await fetch(`/api/skills/${slug}/position`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * `/skills` (Epic 21, T21.4-T21.5 / ADR 0020 stage a): skills as dots
 * inside hand-placed theme regions (`THEME_LAYOUT`), each at its
 * `resolveNodePosition` coordinate — the constellation view. Renders
 * **alongside** the existing grouped-list `SkillMap`, not instead of it
 * (that view still works today and stays; see the epic file's out-of-scope
 * list) — `SkillsPage` decides which is visible.
 *
 * Reuses the shared `SkillRing` (ADR 0016 point 2) for node status — an
 * absolutely-positioned HTML overlay on top of a background SVG that draws
 * only the static theme circles/labels, rather than reimplementing ring
 * drawing as raw SVG `<circle>` elements. `SkillRing`'s own root is a
 * `<div>` wrapping an `<svg>`, which is exactly what makes this overlay
 * approach work without a second ring implementation.
 *
 * The whole thing is one square (`viewBox`/aspect-ratio `LAYOUT_SPACE_SIZE`
 * x `LAYOUT_SPACE_SIZE`) scaled to the container's width via percentages —
 * `resolveNodePosition`'s abstract 0-1000 coordinate space maps directly to
 * 0-100% on both axes, so no separate viewport-aware scaling is needed here;
 * pan/zoom (ADR 0020 decision 8's view layers) is explicitly out of scope
 * for this epic.
 *
 * T21.5 (ADR 0020 decision 5): "Edit positions" is a `md:` breakpoint
 * ("desktop/iPad") affordance only — the toggle button itself is
 * `hidden md:inline-flex`, so on a phone there is no way to *enter* edit
 * mode at all (mobile parity is explicitly not required; dragging is
 * fiddly on phones and this is a rare curation activity). Dragging a node
 * writes a manual override via `/api/skills/[slug]/position` and marks it
 * locked; "reset" clears it back to the computed/hash tiers. `"use client"`
 * is required for pointer-event drag tracking and the fetch-based write —
 * data fetching itself stays in the server page (`SkillsPage`), unaffected.
 */
export function SkillConstellation({ themes }: { themes: SkillMapTheme[] }) {
  const [liveThemes, setLiveThemes] = useState(themes);
  const [editMode, setEditMode] = useState(false);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = assignLabelRows(liveThemes.flatMap((t) => t.nodes));

  function updateLocalPosition(slug: string, x: number, y: number, locked: boolean) {
    setLiveThemes((prev) =>
      prev.map((theme) => ({
        ...theme,
        nodes: theme.nodes.map((node) =>
          node.slug === slug ? { ...node, position: { x, y }, positionLocked: locked } : node,
        ),
      })),
    );
  }

  function pointerToAbstract(clientX: number, clientY: number): { x: number; y: number } | null {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: clamp(((clientX - box.left) / box.width) * LAYOUT_SPACE_SIZE),
      y: clamp(((clientY - box.top) / box.height) * LAYOUT_SPACE_SIZE),
    };
  }

  function handlePointerDown(slug: string, event: React.PointerEvent<HTMLAnchorElement>) {
    if (!editMode) return;
    event.preventDefault(); // suppress navigation while in edit mode
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingSlug(slug);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    if (!draggingSlug) return;
    const point = pointerToAbstract(event.clientX, event.clientY);
    if (!point) return;
    updateLocalPosition(draggingSlug, point.x, point.y, true);
  }

  async function handlePointerUp(event: React.PointerEvent<HTMLAnchorElement>) {
    if (!draggingSlug) return;
    const slug = draggingSlug;
    setDraggingSlug(null);
    const point = pointerToAbstract(event.clientX, event.clientY);
    if (!point) return;
    // Already-updated optimistically by the last pointermove; persist it.
    await postPosition(slug, point);
  }

  async function handleReset(slug: string) {
    const ok = await postPosition(slug, { reset: true });
    if (!ok) return;
    // The freshly-computed hash position isn't known client-side (it's a
    // pure function of slug+theme, available from "@/lib/skills/layout",
    // but re-deriving it here would duplicate resolveNodePosition's
    // reasoning) — a full data refresh (server round-trip) is simplest and
    // correct; a client-side router refresh keeps the rest of the page's
    // scroll position, unlike a full reload.
    window.location.reload();
  }

  return (
    <div>
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className="hidden rounded-full border border-hairline-strong bg-surface-raised px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-hairline md:inline-flex"
        >
          {editMode ? "Done editing" : "Edit positions"}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative mt-2 w-full overflow-hidden rounded-lg border border-hairline bg-surface"
      >
        <div className="relative aspect-square w-full">
          <svg
            viewBox={`0 0 ${LAYOUT_SPACE_SIZE} ${LAYOUT_SPACE_SIZE}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {THEMES.map((theme) => {
              const region = THEME_LAYOUT[theme];
              return (
                <g key={theme}>
                  <circle
                    cx={region.cx}
                    cy={region.cy}
                    r={region.r}
                    fill="none"
                    stroke="var(--color-hairline)"
                    strokeWidth={2}
                  />
                  <text
                    x={region.cx}
                    y={region.cy - region.r + 22}
                    textAnchor="middle"
                    fill="var(--color-ink-faint)"
                    fontSize={16}
                    fontFamily="var(--font-mono)"
                    letterSpacing={1}
                  >
                    {THEME_LABELS[theme].toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>

          {nodes.map((node, index) => (
            // A plain positioning `<div>`, NOT a second `<Link>` — the
            // draggable ring+label below is its own `<Link>`, and the reset
            // `<button>` is a sibling, not a descendant of that anchor.
            // Nesting an interactive element inside an `<a>` is invalid
            // HTML and, worse, means the anchor's own onPointerDown fires
            // first for any pointerdown landing on the nested button too
            // (pointer events target the deepest element but still bubble
            // to the ancestor's listener) — that bug is exactly why an
            // earlier version of this component silently treated every
            // "reset" click as the start of a new drag instead.
            <div
              key={node.slug}
              className="absolute w-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(node.position.x / LAYOUT_SPACE_SIZE) * 100}%`,
                top: `${(node.position.y / LAYOUT_SPACE_SIZE) * 100}%`,
                zIndex: draggingSlug === node.slug ? 30 : index + 1,
              }}
            >
              <Link
                href={editMode ? "#" : `/skills/${node.slug}`}
                // Epic 21 (T21.4/T21.5): several nodes can hash close
                // together inside one theme circle (see resolveNodePosition/
                // hashPositionInRegion's spacing target — a *target*, not a
                // hard guarantee, especially at the current tiny corpus
                // size). The ring itself always renders at the exact
                // resolved (x, y) unless being dragged — but its *label* is
                // placed via `assignLabelRows` (label-only collision
                // avoidance, not a node layout pass; see that function's
                // docstring) so two close labels stack into different rows
                // below their rings instead of overlapping. `hover`/`focus`
                // still lift a label above its neighbours via z-index, the
                // same trick real map labels use when two pins sit very
                // close. line-clamp-2 (not truncate — SkillMap.tsx's
                // readability rule applies here too) keeps the full title,
                // never a hard cut.
                className={`group flex flex-col items-center hover:z-20 focus-visible:z-20 ${
                  editMode ? "cursor-grab touch-none active:cursor-grabbing" : ""
                }`}
                title={node.title}
                onPointerDown={(e) => handlePointerDown(node.slug, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={(e) => {
                  if (editMode) e.preventDefault();
                }}
              >
                <div className="relative flex flex-col items-center">
                  <SkillRing status={node.status} size={NODE_RING_SIZE} />
                  {node.positionLocked && (
                    <span
                      className="absolute top-0 right-0 text-[9px] text-ink-faint"
                      title="Manually placed"
                      aria-label="Manually placed"
                    >
                      📌
                    </span>
                  )}
                </div>
                <span
                  className="line-clamp-2 block rounded bg-surface px-1 text-center text-[10px] leading-tight text-ink group-hover:bg-surface-raised"
                  style={{ marginTop: node.labelRow * 16 }}
                >
                  {node.title}
                </span>
              </Link>
              {editMode && node.positionLocked && (
                <button
                  type="button"
                  onClick={() => void handleReset(node.slug)}
                  className="mt-0.5 block w-full rounded bg-surface-raised text-[9px] text-ink-faint hover:text-ink"
                >
                  reset
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {editMode && (
        <p className="mt-2 text-xs text-ink-faint">
          Drag a node to pin it in place. Locked nodes show 📌 and a reset link.
        </p>
      )}
    </div>
  );
}
