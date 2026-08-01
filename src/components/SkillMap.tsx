import Link from "next/link";
import type { SkillMapTheme } from "@/lib/skills/map";
import { EmptyState } from "./EmptyState";
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
      <EmptyState
        variant="compact"
        title="No active skill nodes yet — confirm a proposal above to create one."
      />
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {themes.map((theme) => (
        <section key={theme.theme}>
          <h3 className="mb-2 font-mono text-xs font-medium tracking-wide text-ink-faint uppercase">
            {theme.theme}
          </h3>
          {/* One column on a narrow phone, two from 400px, three from sm.
              At grid-cols-2 on a 375px screen each tile had ~120px of text
              room, so `truncate` cut every real skill name to ~14 characters
              ("Agentic Tool…", "Computer U…", "Prompt Cac…") — a skill map
              whose labels are unreadable undercuts its own purpose. */}
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
            {theme.nodes.map((node) => (
              <Link
                key={node.slug}
                href={`/skills/${node.slug}`}
                className="relative flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-3 transition-colors hover:border-hairline-strong hover:bg-surface-raised"
              >
                <SkillRing status={node.status} size={GRID_RING_SIZE} />
                <div className="min-w-0 flex-1">
                  {/* line-clamp-2, not truncate: at the narrower two- and
                      three-column widths a long name still needs to wrap
                      rather than lose its distinguishing tail. */}
                  <div className="line-clamp-2 text-sm font-medium text-ink">{node.title}</div>
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
