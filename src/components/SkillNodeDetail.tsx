import Link from "next/link";
import type { SkillNodeDetail as SkillNodeDetailData } from "@/lib/skills/map";
import { PROGRESS_STATUSES } from "@/lib/skills/progress";
import { formatRelativeTime } from "@/lib/relativeTime";

/**
 * `/skills/[slug]` (T7.3): a node's description, associated content (Reels +
 * active Experience Reports, labeled), a status-change form per reachable
 * status (downgrade allowed — no gates), and the note history (= this node's
 * slice of the Adoption-Log, T7.4). Plain HTML forms posting to
 * `/skills/[slug]/progress`, same pattern as the Experience lifecycle forms.
 */
export function SkillNodeDetail({ detail }: { detail: SkillNodeDetailData }) {
  const { node, content, status, notes } = detail;
  const otherStatuses = PROGRESS_STATUSES.filter((s) => s !== status);

  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      <Link href="/skills" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Back to Skill Map
      </Link>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-100">{node.title}</h1>
        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          {node.theme}
        </span>
      </div>
      {node.description && <p className="mt-1 text-sm text-zinc-400">{node.description}</p>}

      {/* TODO(UX pass): gamified visuals — status ring/color, level-up feel.
          Plain text status + plain forms for the foundation slice. */}
      <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
        <p className="text-xs text-zinc-500">
          Current status: <span className="font-medium text-zinc-200">{status}</span>
        </p>
        <div className="mt-3 flex flex-col gap-3">
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
                className="w-48 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <button
                type="submit"
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Mark as {target}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">
          Associated content ({content.length})
        </h2>
        {content.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing tagged with this skill yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {content.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-baseline gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
              >
                <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                  {item.type === "reel" ? "Reel" : "Report"}
                </span>
                {item.type === "reel" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-zinc-200 hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <Link href={`/experience/${item.id}/edit`} className="truncate text-zinc-200 hover:underline">
                    {item.title}
                  </Link>
                )}
                <span className="ml-auto shrink-0 text-xs text-zinc-500">
                  {formatRelativeTime(item.type === "reel" ? item.publishedAt : item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Note history ({notes.length})</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-500">No notes yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {notes.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <time dateTime={entry.createdAt.toISOString()}>
                    {formatRelativeTime(entry.createdAt)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{entry.status}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{entry.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
