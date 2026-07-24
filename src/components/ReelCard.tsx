import type { FeedReel } from "@/lib/feed";
import { isNew } from "@/lib/labels";
import type { ReelActionFlags } from "@/lib/interactions";
import { formatRelativeTime } from "@/lib/relativeTime";
import { ReelCardShell } from "./ReelCardShell";
import { CATEGORY_LABELS, CONFIDENCE_LABELS, EFFORT_LABELS, MATURITY_LABELS } from "./labels";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{children}</span>
  );
}

const NO_INTERACTIONS: ReelActionFlags = { save: false, up: false, down: false };

export interface ReelCardProps {
  reel: FeedReel;
  /** Current save/up/down state, to hydrate the action bar (T6.2). Defaults
   *  to "none active" when omitted. */
  interactions?: ReelActionFlags;
}

/**
 * The reel's content — header/badges/title/summary/example/action/footer.
 * Shared between a plain solo card (ReelCard below) and the "N sources on
 * this topic" stack card (ReelStackCard, Epic 15 T15.4/T15.5), which renders
 * this unchanged for the cluster's primary reel plus its own banner slot on top.
 */
export function ReelCardBody({ reel, stackBanner }: { reel: FeedReel; stackBanner?: React.ReactNode }) {
  const showNewBadge = isNew(reel);

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col overflow-y-auto px-6 pb-20 pt-28">
      {stackBanner}
      <header className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">{reel.sourceName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={reel.publishedAt.toISOString()}>
          {formatRelativeTime(reel.publishedAt)}
        </time>
      </header>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{CATEGORY_LABELS[reel.category]}</Badge>
        <Badge>{MATURITY_LABELS[reel.maturity]}</Badge>
        {reel.experimental && <Badge>🧪 experimental</Badge>}
        {showNewBadge && <Badge>🆕 New</Badge>}
        {/* Epic 11 (ADR 0012, T11.5): corroboration scale, subtle and
            deliberately separate from the R/Q score footer below. Can be
            present even on a solo card — a cluster keeps its confidence even
            when it currently renders with only one visible member. */}
        {reel.confidence && <Badge>🔎 {CONFIDENCE_LABELS[reel.confidence]}</Badge>}
      </div>

      <h2 className="mt-3 text-lg font-semibold leading-snug text-zinc-50">{reel.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{reel.summary}</p>

      {/* Epic 10 (ADR 0011, T10.4): the Stage-1 Reel-Verifier's caveat, if any
          — subtle and non-alarmist by design (small muted text, no boxed
          alert), deliberately separate from both the confidence badge above
          and the R/Q score footer below. Never affects quality_score
          (ADR 0004) — display-layer only. */}
      {reel.caveat && (
        <p className="mt-2 text-xs text-amber-500/80">⚠️ {reel.caveat}</p>
      )}

      {reel.example && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Example (from the source)
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-200">
            {reel.example}
          </pre>
        </div>
      )}

      {reel.action && (
        <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-200">➜ For you: {reel.action}</p>
          {reel.effortTag && (
            <span className="mt-2 inline-block rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
              {EFFORT_LABELS[reel.effortTag]}
            </span>
          )}
        </div>
      )}

      {/* Epic 11 (ADR 0012/0008, T11.5): a freshness-pass supersession
          proposal is shown but never auto-hides the content — only visible
          while lifecycleState is still "active" (once a human confirms via
          the deprecate route, the cluster is deprecated and this notice no
          longer applies to it). */}
      {reel.supersededByClusterId !== null && reel.lifecycleState === "active" && (
        <div className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
          <p className="text-sm text-amber-200">
            🕓 Newer available{reel.supersedeReason ? `: ${reel.supersedeReason}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <a
              href={`/clusters/${reel.supersededByClusterId}`}
              className="text-xs underline decoration-amber-700 underline-offset-2 hover:text-amber-100"
            >
              View newer cluster
            </a>
            <form method="post" action={`/clusters/${reel.topicClusterId}/deprecate`}>
              <button
                type="submit"
                className="rounded-full border border-amber-700 px-3 py-1 text-xs text-amber-200 transition-colors hover:bg-amber-900/40"
              >
                Confirm superseded
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-zinc-500">
        <a
          href={reel.url}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
        >
          View source
        </a>
        <span>
          R {reel.relevanceScore} · Q {reel.qualityScore}
        </span>
      </footer>
    </div>
  );
}

/** One reel card, sized to fill the viewport (see .reel/.feed scroll-snap in page.tsx). */
export function ReelCard({ reel, interactions }: ReelCardProps) {
  return (
    <ReelCardShell reelId={reel.id} initial={interactions ?? NO_INTERACTIONS}>
      <ReelCardBody reel={reel} />
    </ReelCardShell>
  );
}
