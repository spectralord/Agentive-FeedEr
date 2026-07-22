import type { FeedReel } from "@/lib/feed";
import { isNew } from "@/lib/labels";
import { formatRelativeTime } from "@/lib/relativeTime";
import { CATEGORY_LABELS, EFFORT_LABELS, MATURITY_LABELS } from "./labels";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{children}</span>
  );
}

/** One reel card, sized to fill the viewport (see .reel/.feed scroll-snap in page.tsx). */
export function ReelCard({ reel }: { reel: FeedReel }) {
  const showNewBadge = isNew(reel);

  return (
    <article className="reel min-h-dvh snap-start [scroll-snap-stop:always]">
      <div className="mx-auto flex h-dvh max-w-xl flex-col overflow-y-auto px-6 pb-10 pt-28">
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
          {reel.experimental && <Badge>🧪 experimentell</Badge>}
          {showNewBadge && <Badge>🆕 Neu</Badge>}
        </div>

        <h2 className="mt-3 text-lg font-semibold leading-snug text-zinc-50">{reel.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{reel.summary}</p>

        {reel.example && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Beispiel (aus der Quelle)
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-200">
              {reel.example}
            </pre>
          </div>
        )}

        {reel.action && (
          <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
            <p className="text-sm text-emerald-200">➜ Für dich: {reel.action}</p>
            {reel.effortTag && (
              <span className="mt-2 inline-block rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
                {EFFORT_LABELS[reel.effortTag]}
              </span>
            )}
          </div>
        )}

        <footer className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-zinc-500">
          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
          >
            Zur Quelle
          </a>
          <span>
            R {reel.relevanceScore} · Q {reel.qualityScore}
          </span>
        </footer>
      </div>
    </article>
  );
}
