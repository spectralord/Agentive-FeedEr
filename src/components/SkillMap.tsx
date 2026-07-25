import Link from "next/link";
import type { SkillMapTheme } from "@/lib/skills/map";
import { SkillRing } from "./SkillRing";

const GRID_RING_SIZE = 40;

/**
 * `/skills` (T7.3, restyled T18.5 §5.1): active skill nodes (Epic 12's
 * SkillTagger output) grouped by theme in a plain CSS grid — no graph/tree
 * layout, no new lib ("Skill *Map*, not Skill *Tree*"). Each tile shows the
 * shared `SkillRing` (ADR 0016 point 2 — one ring component, three call
 * sites) instead of a plain status pill, plus an experimental-dot marker
 * when a majority of the node's Reels are `experimental`.
 */
export function SkillMap({ themes }: { themes: SkillMapTheme[] }) {
  if (themes.length === 0) {
    return (
      <p className="mt-6 text-sm text-ink-muted">
        No active skill nodes yet — confirm a proposal above to create one.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {themes.map((theme) => (
        <section key={theme.theme}>
          <h3 className="mb-2 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">
            {theme.theme}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {theme.nodes.map((node) => (
              <Link
                key={node.slug}
                href={`/skills/${node.slug}`}
                className="relative flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-3 transition-colors hover:border-hairline-strong hover:bg-surface-raised"
              >
                <SkillRing status={node.status} size={GRID_RING_SIZE} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{node.title}</div>
                  <div className="mt-1 font-mono text-xs text-ink-muted">
                    {node.contentCount} item{node.contentCount === 1 ? "" : "s"}
                  </div>
                </div>
                {node.experimentalDot && (
                  <span
                    className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-ink-faint"
                    title="Majority of associated Reels are experimental"
                    aria-label="Majority experimental"
                  />
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
