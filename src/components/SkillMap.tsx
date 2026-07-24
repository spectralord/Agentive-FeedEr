import Link from "next/link";
import type { SkillMapTheme } from "@/lib/skills/map";

/**
 * `/skills` (T7.3): active skill nodes (Epic 12's SkillTagger output)
 * grouped by theme in a plain CSS grid — no graph/tree layout, no new lib.
 * Deliberately minimal: status is shown as plain text, not the gamified
 * rings/colors a later UX pass will add (see epic-7-skill-map.md Abweichungen).
 */
export function SkillMap({ themes }: { themes: SkillMapTheme[] }) {
  if (themes.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500">
        No active skill nodes yet — confirm a proposal above to create one.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      {themes.map((theme) => (
        <section key={theme.theme}>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {theme.theme}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {theme.nodes.map((node) => (
              <Link
                key={node.slug}
                href={`/skills/${node.slug}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
              >
                {/* TODO(UX pass): gamified visuals — status rings/colors
                    (gray=seen/blue=tried/gold=mastered), experimental-dot,
                    level-up feel. Deliberately plain for the foundation slice. */}
                <div className="text-sm font-medium text-zinc-100">{node.title}</div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {node.contentCount} item{node.contentCount === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">
                    {node.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
