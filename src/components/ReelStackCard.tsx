"use client";

import { useState } from "react";
import type { FeedReel } from "@/lib/feed";
import type { ReelActionFlags } from "@/lib/interactions";
import type { ReelDetailData } from "./reelDetailData";
import { ReelCardBody } from "./ReelCardBody";
import { ReelCardShell } from "./ReelCardShell";
import { SourceAvatar } from "./SourceAvatar";

const NO_INTERACTIONS: ReelActionFlags = { save: false, up: false, down: false };

export interface ReelStackCardProps {
  clusterTitle: string;
  primary: FeedReel;
  others: FeedReel[];
  /** Save/up/down state for the primary reel (T6.2 hydration), same as ReelCard. */
  interactions?: ReelActionFlags;
  /**
   * Built by the caller via `buildReelDetailData` (see reelDetailData.ts)
   * and passed down pre-built, rather than computed inside this component.
   * `ReelStackCard` is a Client Component (`"use client"`, for the
   * show/hide-sources toggle below) — `buildReelDetailData` transitively
   * pulls in `src/lib/skills/reelSkillTab.ts` (a DB-touching module, for
   * T18.7's Skill tab data) via `pickSkillTabPreview`, which is only safe
   * to import from a Server Component. Building `detail` one level up (in
   * `page.tsx`/`today/page.tsx`, both Server Components) and passing the
   * plain, already-serializable result down avoids dragging `pg` into the
   * browser bundle — `next build` fails loudly (`Can't resolve 'tls'`) if
   * this boundary isn't respected.
   */
  detail: ReelDetailData;
}

/**
 * Epic 15 (T15.4/T15.5): a topic cluster with >= 2 displayed members renders
 * as one stack card instead of N separate cards — the primary member's full
 * content on top (identical to a solo ReelCard), with a banner showing "N
 * sources on this topic" and an expandable list of the other members' source
 * names + titles. The raw source count + names here is separate from Epic
 * 11's `confidence` (few/some/strong) badge, which ReelCardBody renders
 * itself (shared with the solo ReelCard) whenever the primary reel's cluster
 * has a computed confidence — no special-casing needed here.
 *
 * T18.2 (§2.1): banner restyled onto the token system, with small
 * source-initial avatars (matching the Context tab's source list, T18.6)
 * instead of a plain bullet list.
 *
 * The card-level hide/save/up/down actions apply to the primary reel only,
 * same as a solo card; the other members have no separate action bar here
 * (out of scope for this epic). Hiding the primary removes the whole stack
 * from view immediately (client-side); on the next load it correctly shows
 * the remaining member(s) — as a solo card if only one is left (see
 * groupReelsForFeed in src/lib/feed.ts).
 */
export function ReelStackCard({ clusterTitle, primary, others, interactions, detail }: ReelStackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalSources = 1 + others.length;

  const banner = (
    // T18.6 (§2.3): data-no-open — the "Show/Hide sources" toggle and the
    // other members' links must keep working; without this the Detail
    // tap-open handler in ReelCardShell would swallow their clicks too.
    <div className="mb-3 rounded-lg border border-hairline bg-surface p-3" data-no-open>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">{clusterTitle}</p>
          <p className="text-sm text-ink-muted">{totalSources} sources on this topic</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 rounded-full border border-hairline-strong px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-raised"
        >
          {expanded ? "Hide sources" : "Show sources"}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-2 border-t border-hairline pt-2">
          <li className="flex items-center gap-2.5">
            <SourceAvatar sourceName={primary.sourceName} />
            <p className="text-xs text-ink-muted">
              <span className="font-medium text-ink">{primary.sourceName}</span> — {primary.title}{" "}
              <span className="text-ink-faint">(primary)</span>
            </p>
          </li>
          {others.map((member) => (
            <li key={member.id} className="flex items-center gap-2.5">
              <SourceAvatar sourceName={member.sourceName} />
              <a
                href={member.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-ink-muted hover:text-ink"
              >
                <span className="font-medium text-ink">{member.sourceName}</span> — {member.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <ReelCardShell reelId={primary.id} initial={interactions ?? NO_INTERACTIONS} detail={detail}>
      <ReelCardBody reel={primary} stackBanner={banner} />
    </ReelCardShell>
  );
}
