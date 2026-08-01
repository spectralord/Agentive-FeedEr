"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { THEME_LABELS } from "@/lib/skills";
import type { SkillNodeDetail as SkillNodeDetailData } from "@/lib/skills/map";
// Type-only import — erased at compile time, so this never drags
// `@/lib/actionables`'s `db`/`pg` import chain into the client bundle. Same
// established pattern as the `SkillNodeDetailData` import above, whose
// source module (`@/lib/skills/map`) is equally DB-touching.
import type { ActionableListItem, EffortTag } from "@/lib/actionables";
import type { DisplayStatus } from "@/lib/skills/progressStatus";
import { PROGRESS_STATUSES } from "@/lib/skills/progressStatus";
import { formatRelativeTime } from "@/lib/relativeTime";
import { submitFormOptimistic } from "@/lib/optimisticForm";
import { ActionableTick } from "./ActionableTick";
import { EFFORT_LABELS } from "./labels";
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
 * `/skills/[slug]` (T7.3, restyled T18.5 §5.1, made optimistic T18.14 §10.8):
 * a node's description, its shared `SkillRing` (ADR 0016 point 2) + status
 * label, associated content (Reels + active Experience Reports, labeled), a
 * status-change form per reachable status (downgrade allowed — no gates),
 * and the note history (= this node's slice of the Adoption-Log, T7.4).
 *
 * Each status form is still a plain `<form method="post"
 * action="/skills/[slug]/progress">` — the exact same route/mutation the
 * page always posted to, still the **only** `setProgress` write path
 * (§8.4). A `"use client"` `onSubmit` handler intercepts it *when JS has
 * hydrated*, flips `status` state immediately (so the ring/label update
 * without a reload or losing scroll position — §10.8's whole point) and
 * POSTs the same form's own `FormData` via `submitFormOptimistic`; on
 * failure it reverts `status` and shows a visible inline note. Without JS,
 * no handler ever attaches — the form submits natively exactly as before.
 * `key={status}` on `SkillRing` forces a fresh instance per real transition
 * so its one-time fill animation (T18.5) replays on every change, not just
 * the first one after a full-page load — see the Abweichungen note in the
 * epic file for why this was needed once mutations stopped reloading the
 * page.
 */
export function SkillNodeDetail({ detail, previousStatus }: SkillNodeDetailProps) {
  const { node, content, notes, actionables } = detail;
  const [status, setStatus] = useState<DisplayStatus>(detail.status);
  const [transitionFrom, setTransitionFrom] = useState<DisplayStatus | undefined>(previousStatus);
  const [errorText, setErrorText] = useState<string | null>(null);
  const otherStatuses = PROGRESS_STATUSES.filter((s) => s !== status);
  const justChanged = transitionFrom !== undefined && transitionFrom !== status;
  // Epic 20 (ADR 0019 decision 2): local count so a tick in the list below
  // (which does NOT touch `status` — see ActionableListSection) still
  // updates the number shown next to the ring, without a full reload. Never
  // fed back into `status`/`transitionFrom` above — the two tracks stay
  // independent both in the data model and in this component's own state.
  const [evidenceCount, setEvidenceCount] = useState(detail.evidenceCount);

  async function handleStatusSubmit(event: React.FormEvent<HTMLFormElement>, target: DisplayStatus) {
    event.preventDefault();
    const form = event.currentTarget;
    const previous = status;
    setErrorText(null);
    setTransitionFrom(previous);
    setStatus(target);

    const ok = await submitFormOptimistic({
      action: form.action,
      method: form.method,
      formData: new FormData(form),
    });

    if (!ok) {
      setStatus(previous);
      setTransitionFrom(undefined);
      setErrorText("Couldn't save — try again.");
      return;
    }
    form.reset();
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      {/* T18.13 (§10.6): the one back-affordance rule, see BackLink.tsx. */}
      <BackLink href="/skills" label="Skill Map" />

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-ink">{node.title}</h1>
        <span className="shrink-0 rounded-full border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-ink-muted">
          {THEME_LABELS[node.theme]}
        </span>
      </div>
      {node.description && <p className="mt-1 text-sm text-ink-muted">{node.description}</p>}

      <section className="mt-5 rounded-lg border border-hairline bg-surface px-4 py-4">
        {/* Epic 20 (ADR 0019 decision 2): the two tracks, side by side, both
            visible, neither gating the other. DECLARED (self-reported,
            SkillRing + status label, left) and EVIDENCED (completed
            Actionables, plain count, right) are two independent numbers on
            purpose — "mastered with zero evidence" must render exactly like
            this, not collapse into one figure. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SkillRing key={status} status={status} previousStatus={transitionFrom} />
            <div>
              <p className={`font-mono text-[11px] tracking-wide uppercase ${STATUS_LABEL_CLASS[status]}`}>
                {status}
              </p>
              <p className="mt-0.5 text-[10.5px] text-ink-faint">Declared</p>
              {justChanged && <p className="mt-1 text-xs text-ink-muted">Marked as {status}.</p>}
              {/* A failed request must roll back visibly (T18.14) — ADR 0016
                  reserves --caution for caveat/supersession only, so a mutation
                  error uses the same "brightness escalation on a neutral
                  token" treatment T18.11 already established for salience
                  without spending a reserved color. */}
              {errorText && <p className="mt-1 text-xs font-medium text-ink">⚠ {errorText}</p>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] tracking-wide uppercase text-action">
              {evidenceCount} {evidenceCount === 1 ? "item" : "items"}
            </p>
            <p className="mt-0.5 text-[10.5px] text-ink-faint">Evidenced</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {otherStatuses.map((target) => (
            <form
              key={target}
              action={`/skills/${node.slug}/progress`}
              method="post"
              onSubmit={(event) => handleStatusSubmit(event, target)}
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

      <ActionableListSection
        nodeSlug={node.slug}
        actionables={actionables}
        declaredStatus={status}
        onCompletionCountChange={(delta) => setEvidenceCount((c) => c + delta)}
        onStatusChangeRequest={handleStatusSubmit}
      />

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

const EFFORT_FILTERS: (EffortTag | "all")[] = ["all", "5-min-test", "afternoon", "know-only"];
type SortMode = "recent" | "effort";

/**
 * T20.4 (ADR 0019): the node page's To-Try list — every Actionable tagged to
 * this node (already filtered to non-null `action` by `listActionablesForNode`,
 * server-side), each row a title/tick/effort-tag/supersession-label. Filter
 * and sort by effort (decision 6) are client-side over the already-fetched
 * list — small lists (this project's real data: single digits per node), so
 * a second network round-trip per filter change would be pure overhead.
 *
 * Ticking a row uses the shared `ActionableTick` (§8.4 — the SAME component
 * the Reel Detail Skill tab uses, POSTing to the same route) and does NOT
 * touch `status`/`SkillRing` above — only `onCompletionCountChange` bumps
 * the parent's local evidence count. A fresh (not un-toggle) completion
 * offers a one-time, dismissible suggestion to also mark the skill as
 * "tried" via `onStatusChangeRequest` (the same `handleStatusSubmit` the
 * status forms above use) — never an automatic write.
 */
function ActionableListSection({
  nodeSlug,
  actionables,
  declaredStatus,
  onCompletionCountChange,
  onStatusChangeRequest,
}: {
  nodeSlug: string;
  actionables: ActionableListItem[];
  declaredStatus: DisplayStatus;
  onCompletionCountChange: (delta: 1 | -1) => void;
  onStatusChangeRequest: (event: React.FormEvent<HTMLFormElement>, target: DisplayStatus) => void;
}) {
  const [effortFilter, setEffortFilter] = useState<EffortTag | "all">("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [suggestFor, setSuggestFor] = useState<number | null>(null);

  const visible = useMemo(() => {
    const filtered = effortFilter === "all" ? actionables : actionables.filter((a) => a.effortTag === effortFilter);
    const rank: Record<EffortTag, number> = { "5-min-test": 0, afternoon: 1, "know-only": 2 };
    const sorted = [...filtered];
    if (sort === "effort") {
      sorted.sort((a, b) => {
        const ra = a.effortTag ? rank[a.effortTag] : Number.MAX_SAFE_INTEGER;
        const rb = b.effortTag ? rank[b.effortTag] : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      });
    } else {
      sorted.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    }
    return sorted;
  }, [actionables, effortFilter, sort]);

  function handleCompleted(reelId: number) {
    if (declaredStatus === "untouched" || declaredStatus === "seen") {
      setSuggestFor(reelId);
    }
  }

  if (actionables.length === 0) {
    return (
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">To-Try (0)</h2>
        <p className="text-sm text-ink-faint">No sourced actions for this skill yet.</p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-muted">To-Try ({actionables.length})</h2>
      </div>

      {/* ADR 0019 decision 6: filter/sort by effort. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {EFFORT_FILTERS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setEffortFilter(tag)}
            aria-pressed={effortFilter === tag}
            className={`min-h-8 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
              effortFilter === tag
                ? "border-action bg-action-soft text-action"
                : "border-hairline text-ink-muted hover:border-hairline-strong"
            }`}
          >
            {tag === "all" ? "All" : EFFORT_LABELS[tag]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSort((s) => (s === "recent" ? "effort" : "recent"))}
          className="ml-auto min-h-8 rounded-full border border-hairline px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-hairline-strong"
        >
          Sort: {sort === "recent" ? "Newest" : "Least effort"}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {visible.map((item) => (
          <li key={item.reelId} className="rounded-lg border border-hairline bg-surface px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <ActionableTick
                reelId={item.reelId}
                initialDone={item.completion !== null}
                onCompleted={() => handleCompleted(item.reelId)}
                onToggled={(done) => onCompletionCountChange(done ? 1 : -1)}
                variant="row"
              />
              <div className="min-w-0 flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-medium text-ink hover:underline"
                >
                  {item.title}
                </a>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {item.completion ? item.completion.actionText : item.action}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {item.effortTag && (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {EFFORT_LABELS[item.effortTag]}
                    </span>
                  )}
                  {item.completion && (
                    <span className="text-[10.5px] text-ink-faint">
                      Done {formatRelativeTime(item.completion.doneAt)}
                    </span>
                  )}
                </div>
                {/* ADR 0019 resolved open question: supersession LABELS,
                    never hides or expires, the Actionable. --caution is
                    correct here (ADR 0016: caveat + freshness/supersession). */}
                {item.supersession && (
                  <p className="mt-1.5 text-[11px] text-caution">
                    🕓 Newer available{item.supersession.reason ? `: ${item.supersession.reason}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* One-time, dismissible suggestion right after THIS row's
                completion — never an automatic write (ADR 0019). */}
            {suggestFor === item.reelId && (
              <form
                method="post"
                action={`/skills/${nodeSlug}/progress`}
                onSubmit={(event) => {
                  setSuggestFor(null);
                  onStatusChangeRequest(event, "tried");
                }}
                className="mt-2.5 flex items-center justify-between gap-2.5 rounded-lg border border-action/30 bg-action-soft p-2.5"
              >
                <input type="hidden" name="status" value="tried" />
                <span className="text-[11.5px] text-ink">Mark this skill as tried?</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSuggestFor(null)}
                    aria-label="Dismiss"
                    className="grid min-h-8 min-w-8 place-items-center rounded-full text-ink-faint hover:text-ink-muted"
                  >
                    ✕
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-action px-3 py-1.5 text-[11px] font-semibold text-ground"
                  >
                    Mark as tried
                  </button>
                </span>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
