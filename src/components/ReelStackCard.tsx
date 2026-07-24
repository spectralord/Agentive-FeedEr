"use client";

import { useState } from "react";
import type { FeedReel } from "@/lib/feed";
import type { ReelActionFlags } from "@/lib/interactions";
import { ReelCardBody } from "./ReelCard";
import { ReelCardShell } from "./ReelCardShell";

const NO_INTERACTIONS: ReelActionFlags = { save: false, up: false, down: false };

export interface ReelStackCardProps {
  clusterTitle: string;
  primary: FeedReel;
  others: FeedReel[];
  /** Save/up/down state for the primary reel (T6.2 hydration), same as ReelCard. */
  interactions?: ReelActionFlags;
}

/**
 * Epic 15 (T15.4/T15.5): a topic cluster with >= 2 displayed members renders
 * as one stack card instead of N separate cards — the primary member's full
 * content on top (identical to a solo ReelCard), with a banner showing "N
 * sources on this topic" and an expandable list of the other members' source
 * names + titles. Deliberately no confidence badge here (few/some/strong is
 * Epic 11's `is_primary`-derived corroboration scale) — only the raw source
 * count + names, per ADR 0013's MVP cut.
 *
 * The card-level hide/save/up/down actions apply to the primary reel only,
 * same as a solo card; the other members have no separate action bar here
 * (out of scope for this epic). Hiding the primary removes the whole stack
 * from view immediately (client-side); on the next load it correctly shows
 * the remaining member(s) — as a solo card if only one is left (see
 * groupReelsForFeed in src/lib/feed.ts).
 */
export function ReelStackCard({ clusterTitle, primary, others, interactions }: ReelStackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalSources = 1 + others.length;

  const banner = (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{clusterTitle}</p>
          <p className="text-sm text-zinc-300">{totalSources} sources on this topic</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          {expanded ? "Hide sources" : "Show sources"}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
          <li>
            <span className="font-medium text-zinc-300">{primary.sourceName}</span> — {primary.title}{" "}
            <span className="text-zinc-500">(primary)</span>
          </li>
          {others.map((member) => (
            <li key={member.id}>
              <a
                href={member.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-200"
              >
                <span className="font-medium text-zinc-300">{member.sourceName}</span> — {member.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <ReelCardShell reelId={primary.id} initial={interactions ?? NO_INTERACTIONS}>
      <ReelCardBody reel={primary} stackBanner={banner} />
    </ReelCardShell>
  );
}
