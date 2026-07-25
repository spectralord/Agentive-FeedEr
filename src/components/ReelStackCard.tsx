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

/** Same source-initial treatment as the Context tab's source list
 *  (docs/specs/prototypes/reel-card-and-detail.html `.source-avatar`) — first
 *  two alphanumeric characters of the source name, uppercased. */
function initials(sourceName: string): string {
  return sourceName.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
}

function SourceAvatar({ sourceName }: { sourceName: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-hairline-strong bg-surface-raised font-mono text-[10.5px] font-semibold text-accent"
    >
      {initials(sourceName)}
    </span>
  );
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
export function ReelStackCard({ clusterTitle, primary, others, interactions }: ReelStackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalSources = 1 + others.length;

  const banner = (
    <div className="mb-3 rounded-lg border border-hairline bg-surface p-3">
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
    <ReelCardShell reelId={primary.id} initial={interactions ?? NO_INTERACTIONS}>
      <ReelCardBody reel={primary} stackBanner={banner} />
    </ReelCardShell>
  );
}
