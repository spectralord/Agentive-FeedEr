import Link from "next/link";
import type { AdoptionLogEntry } from "@/lib/skills/progress";
import { formatRelativeTime } from "@/lib/relativeTime";

/**
 * `/skills` (T7.4): "what I actually adopted through the tool" — every
 * `user_progress` note across every node, newest first. Epic 6 dropped the
 * reel `tried` interaction (docs/plan/epic-6-interactions.md, "Revidiert
 * 2026-07-23"), so this is the only source now (documented deviation in
 * epic-7-skill-map.md — the original T7.4 wording assumed a second source).
 */
export function AdoptionLog({ entries }: { entries: AdoptionLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">No adopted notes yet.</p>;
  }

  return (
    <ol className="mt-4 flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <time dateTime={entry.createdAt.toISOString()}>{formatRelativeTime(entry.createdAt)}</time>
            <span aria-hidden="true">·</span>
            <Link href={`/skills/${entry.nodeSlug}`} className="text-zinc-300 hover:underline">
              {entry.nodeTitle}
            </Link>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{entry.status}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-300">{entry.note}</p>
        </li>
      ))}
    </ol>
  );
}
