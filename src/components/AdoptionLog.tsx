import Link from "next/link";
import type { AdoptionLogEntry } from "@/lib/skills/progress";
import { formatRelativeTime } from "@/lib/relativeTime";
import { EmptyState } from "./EmptyState";

/**
 * `/skills` (T7.4, extended T20.5): "what I actually adopted through the
 * tool" — every `user_progress` note (a declared-status change) AND every
 * completed Actionable with a note, merged newest-first by the caller
 * (`listAdoptionLog`). This component renders in the GIVEN order — it does
 * not re-sort or re-merge — and only varies the badge/label by
 * `entry.source`: "progress" keeps the original status badge; "actionable"
 * shows the snapshotted action text instead of a status (Epic 6's removal
 * of a reel-level `tried` interaction stands — this is a NODE completion,
 * never rendered as a reel check-off).
 */
export function AdoptionLog({ entries }: { entries: AdoptionLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState variant="compact" title="No adopted notes yet." />;
  }

  return (
    <ol className="mt-4 flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={`${entry.source}-${entry.id}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <time dateTime={entry.createdAt.toISOString()}>{formatRelativeTime(entry.createdAt)}</time>
            <span aria-hidden="true">·</span>
            <Link href={`/skills/${entry.nodeSlug}`} className="text-zinc-300 hover:underline">
              {entry.nodeTitle}
            </Link>
            {entry.source === "progress" ? (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{entry.status}</span>
            ) : (
              <span className="rounded-full border border-action/30 bg-action-soft px-2 py-0.5 text-action">
                done
              </span>
            )}
          </div>
          {entry.source === "actionable" && (
            <p className="mt-1 text-xs text-ink-faint">{entry.actionText}</p>
          )}
          <p className="mt-1 text-sm text-zinc-300">{entry.note}</p>
        </li>
      ))}
    </ol>
  );
}
