import Link from "next/link";
import type { SkillNodeDetail as SkillNodeDetailData } from "@/lib/skills/map";
import type { DisplayStatus } from "@/lib/skills/progress";
import { PROGRESS_STATUSES } from "@/lib/skills/progress";
import { formatRelativeTime } from "@/lib/relativeTime";
import { BackLink } from "./BackLink";
import { SkillRing } from "./SkillRing";

/** Matches `skill-constellation.html`'s `.p-status.<status>` colors
 *  exactly — the one place the four states get a text-color treatment
 *  alongside the ring. */
const STATUS_LABEL_CLASS: Record<DisplayStatus, string> = {
  untouched: "text-ink-faint",
  seen: "text-ink-muted",
  tried: "text-accent",
  mastered: "text-gold",
};

interface SkillNodeDetailProps {
  detail: SkillNodeDetailData;
  /** Set by the page only when the just-completed status POST actually
   *  changed the status (see `/skills/[slug]/progress/route.ts`'s `?from=`
   *  param). Drives both the ring's one-time fill animation and the plain
   *  confirmation line — §5.1's "level-up feel, deliberately not kitsch":
   *  no confetti, no popup, just the ring visibly filling once. */
  previousStatus?: DisplayStatus;
}

/**
 * `/skills/[slug]` (T7.3, restyled T18.5 §5.1): a node's description, its
 * shared `SkillRing` (ADR 0016 point 2) + status label, associated content
 * (Reels + active Experience Reports, labeled), a status-change form per
 * reachable status (downgrade allowed — no gates), and the note history
 * (= this node's slice of the Adoption-Log, T7.4). Plain HTML forms posting
 * to `/skills/[slug]/progress`, same pattern as the Experience lifecycle
 * forms.
 */
export function SkillNodeDetail({ detail, previousStatus }: SkillNodeDetailProps) {
  const { node, content, status, notes } = detail;
  const otherStatuses = PROGRESS_STATUSES.filter((s) => s !== status);
  const justChanged = previousStatus !== undefined && previousStatus !== status;

  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      {/* T18.13 (§10.6): the one back-affordance rule, see BackLink.tsx. */}
      <BackLink href="/skills" label="Skill Map" />

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-ink">{node.title}</h1>
        <span className="shrink-0 rounded-full border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-ink-muted">
          {node.theme}
        </span>
      </div>
      {node.description && <p className="mt-1 text-sm text-ink-muted">{node.description}</p>}

      <section className="mt-5 rounded-lg border border-hairline bg-surface px-4 py-4">
        <div className="flex items-center gap-4">
          <SkillRing status={status} previousStatus={previousStatus} />
          <div>
            <p className={`font-mono text-[11px] tracking-wide uppercase ${STATUS_LABEL_CLASS[status]}`}>
              {status}
            </p>
            {justChanged && <p className="mt-1 text-xs text-ink-muted">Marked as {status}.</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {otherStatuses.map((target) => (
            <form
              key={target}
              action={`/skills/${node.slug}/progress`}
              method="post"
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="status" value={target} />
              <input
                type="text"
                name="note"
                placeholder="Note (optional)"
                className="w-48 rounded-full border border-hairline bg-surface-raised px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-hairline-strong"
              />
              <button
                type="submit"
                className="rounded-full border border-hairline-strong bg-surface-raised px-3 py-1.5 text-xs text-ink transition-colors hover:bg-hairline"
              >
                Mark as {target}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">
          Associated content ({content.length})
        </h2>
        {content.length === 0 ? (
          <p className="text-sm text-ink-faint">Nothing tagged with this skill yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {content.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-baseline gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm"
              >
                <span className="shrink-0 rounded-full border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                  {item.type === "reel" ? "Reel" : "Report"}
                </span>
                {item.type === "reel" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-ink hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <Link href={`/experience/${item.id}/edit`} className="truncate text-ink hover:underline">
                    {item.title}
                  </Link>
                )}
                <span className="ml-auto shrink-0 font-mono text-xs text-ink-faint">
                  {formatRelativeTime(item.type === "reel" ? item.publishedAt : item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Note history ({notes.length})</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-ink-faint">No notes yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {notes.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-hairline bg-surface px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-xs text-ink-faint">
                  <time dateTime={entry.createdAt.toISOString()}>
                    {formatRelativeTime(entry.createdAt)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span className="rounded-full border border-hairline bg-surface-raised px-2 py-0.5 text-ink-muted">
                    {entry.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">{entry.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
