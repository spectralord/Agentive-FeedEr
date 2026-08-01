"use client";

import { useState } from "react";
import { submitFormOptimistic } from "@/lib/optimisticForm";
import { EFFORT_LABELS } from "./labels";
import { SkillRing } from "./SkillRing";
import { SourceAvatar } from "./SourceAvatar";
import type { ReelDetailData, SkillTabView } from "./reelDetailData";

/**
 * T18.6/T18.7 (§2.2, §7 #6/#8): the Detail overlay's tab system. Genuinely
 * generic — `TAB_DEFS` + `isTabEmpty` is an array of descriptors each
 * carrying a "would this tab render only its empty state?" predicate; the
 * visible set is just `TAB_DEFS` filtered by that predicate (Write-up is
 * exempted, per the rule that governs Context and Skill only).
 *
 * Rendered inside the client `ReelCardShell`, which owns the open/tab state
 * and the tap/swipe gesture handlers (§2.3) — this component is presentational
 * only (props in, `onSelectTab`/`onClose` callbacks out).
 */

export type TabId = "writeup" | "context" | "skill";

interface TabDef {
  id: TabId;
  label: string;
}

const TAB_DEFS: TabDef[] = [
  { id: "writeup", label: "Write-up" },
  { id: "context", label: "Context" },
  { id: "skill", label: "Skill" },
];

/** §2.2's hiding rule: "hide a tab entirely if it would render only its
 *  empty state" — Write-up is short-circuited to `false` (never hidden;
 *  see judgment call 2 in the epic file) before this is ever consulted. */
function isTabEmpty(id: TabId, data: ReelDetailData): boolean {
  switch (id) {
    case "writeup":
      return false;
    case "context":
      return data.clusterMembers.length === 0 && data.caveat === null;
    case "skill":
      // T18.7 (§7 #8): no `reel.skill` (or the matched node couldn't be
      // resolved) -> nothing to show -> hide, same rule as Context.
      return data.skill === undefined;
  }
}

function skillStatusTextClass(status: string): string {
  if (status === "tried") return "text-accent";
  if (status === "mastered") return "text-gold";
  if (status === "seen") return "text-ink-muted";
  return "text-ink-faint"; // untouched
}

function WriteupPanel({ data }: { data: ReelDetailData }) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-hairline pb-3.5 text-xs text-ink-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span>
          From <b className="font-semibold text-ink">{data.sourceName}</b>
        </span>
      </div>

      {data.writeup ? (
        <div className="mt-3.5 space-y-3.5">
          {data.writeup.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-ink">
              {para}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-3.5">
          {/* ADR 0017 (T18.6): writeup stays NULL until the enrichment pass
              ships. Explicit, unmistakable placeholder — never invented
              prose, never a silent re-show of `summary` (ADR 0016 point 3
              as amended). The italic bordered lines below exist only so the
              tab's scroll/flow can be felt on a real phone screen. */}
          {/* No ADR/epic number in user-facing copy (design doc §10.7: no
              developer-facing empty states). The reference belongs in the
              comment above, not on the reader's screen. */}
          <p className="text-xs italic text-ink-faint">
            Long-form write-up not generated yet. What follows is placeholder filler, not real
            content.
          </p>
          <div aria-label="Placeholder filler, not real content" className="mt-3.5 space-y-3.5 opacity-50">
            {[0, 1, 2].map((i) => (
              <p
                key={i}
                className="border-l-2 border-hairline-strong pl-3 text-[13px] italic leading-relaxed text-ink-faint"
              >
                [Placeholder paragraph — no write-up has been generated for this Reel yet. This line
                repeats only to preview how the tab scrolls, and is not derived from the source.]
              </p>
            ))}
          </div>
        </div>
      )}

      {data.example && (
        <div className="mt-4">
          <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">
            Example (from the source)
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-hairline bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-ink-muted">
            {data.example}
          </pre>
        </div>
      )}
    </>
  );
}

function ContextPanel({ data }: { data: ReelDetailData }) {
  return (
    <>
      <span className="mb-2.5 block font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        Related / similar sources
      </span>
      {data.clusterMembers.length === 0 ? (
        <div className="py-1">
          <p className="text-[12.5px] text-ink-muted">Single-sourced.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            No related coverage found (yet) — most Reels look like this. When several sources
            converge on the same thing, they&apos;ll be listed here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {data.clusterMembers.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              data-no-open
              className="flex items-start gap-2.5 border-t border-hairline py-2.5 first:border-t-0 first:pt-0"
            >
              <SourceAvatar sourceName={m.sourceName} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink">{m.sourceName}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-muted">{m.title}</span>
              </span>
              <span className="shrink-0 text-[11px] text-ink-faint">{m.timeLabel}</span>
            </a>
          ))}
        </div>
      )}

      {data.caveat && (
        <div className="mt-4 rounded-lg border border-caution/30 bg-caution/10 p-3 text-xs leading-relaxed text-caution">
          <span aria-hidden="true">⚠</span> {data.caveat}
        </div>
      )}
    </>
  );
}

/**
 * T18.7 (§5.2, §8.4): status ring (SkillRing — T18.5's ONE ring component,
 * ADR 0016 point 2 — reused, not reinvented) + skill name/theme/status +
 * node description; `reel.action`/`effortTag` (moved here from Compact by
 * T18.2); the "Mark as tried" quick action ONLY when `status === "seen"`,
 * a plain `<form method="post" action="/skills/[slug]/progress">` —
 * literally the same route + `setProgressBySlug` mutation the node detail
 * page's own status form posts to (§8.4's hard constraint: never a second
 * implementation).
 *
 * T18.14 (§10.8): made optimistic. The form is unchanged (still the same
 * action/method/hidden `status=tried` input — the no-JS fallback still
 * works exactly as before); a `"use client"` `onSubmit` handler flips this
 * panel's own local `status` state immediately (ring + label update,
 * "Tried this already?" disappears, all without leaving the feed or
 * losing scroll position — T18.7's own notes recorded this full-page-POST
 * choice as deliberately conservative, pending exactly this task) and POSTs
 * the same form's `FormData` via `submitFormOptimistic`; on failure it
 * reverts and shows a visible inline note. `key={status}` forces a fresh
 * `SkillRing` per real transition so the one-time fill animation (T18.5)
 * plays here too, same reasoning as `SkillNodeDetail.tsx`.
 */
function SkillPanel({ data }: { data: ReelDetailData }) {
  const skill = data.skill;
  const [status, setStatus] = useState<SkillTabView["status"] | undefined>(skill?.status);
  const [justMarked, setJustMarked] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  if (!skill) return null;
  const originalStatus = skill.status;
  const currentStatus = status ?? originalStatus;

  async function handleMarkTried(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorText(null);
    setJustMarked(false);
    setStatus("tried");

    const ok = await submitFormOptimistic({
      action: form.action,
      method: form.method,
      formData: new FormData(form),
    });

    if (!ok) {
      setStatus(originalStatus);
      setErrorText("Couldn't save — try again.");
      return;
    }
    setJustMarked(true);
  }

  return (
    <>
      <div className="flex items-center gap-3.5">
        <SkillRing
          key={currentStatus}
          status={currentStatus}
          previousStatus={currentStatus === "tried" && originalStatus === "seen" ? "seen" : undefined}
          size={52}
        />
        <div>
          <p className="text-[15.5px] font-semibold text-ink">{skill.title}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{skill.theme}</p>
          <p
            className={`mt-0.5 font-mono text-[10.5px] uppercase tracking-wide ${skillStatusTextClass(currentStatus)}`}
          >
            {currentStatus}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">{skill.description}</p>

      {/* Sourced-only (ADR 0005): reel.action/effortTag are this REEL's own
          fields — no action means nothing renders, nothing invented. */}
      {skill.action && (
        <div className="mt-4 rounded-xl border border-action/30 bg-action-soft p-3">
          <p className="font-mono text-[9.5px] uppercase tracking-wide text-action">Action</p>
          <p className="mt-1 text-xs text-ink">{skill.action}</p>
          {skill.effortTag && <p className="mt-1 text-[10.5px] text-ink-faint">{EFFORT_LABELS[skill.effortTag]}</p>}
        </div>
      )}

      {currentStatus === "seen" && (
        <form
          method="post"
          action={`/skills/${skill.slug}/progress`}
          data-no-open
          onSubmit={handleMarkTried}
          className="mt-4 flex items-center justify-between gap-2.5 rounded-xl border border-action/30 bg-action-soft p-3"
        >
          <input type="hidden" name="status" value="tried" />
          <span className="text-xs text-ink">Tried this already?</span>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-action px-3.5 py-1.5 text-[11.5px] font-semibold text-ground"
          >
            Mark as tried
          </button>
        </form>
      )}
      {justMarked && currentStatus === "tried" && (
        <p className="mt-4 text-xs text-ink-muted">Marked as tried.</p>
      )}
      {/* Visible rollback (T18.14) — same neutral-brightness treatment as
          SkillNodeDetail.tsx, never --caution (ADR 0016: caveat/supersession
          only). */}
      {errorText && <p className="mt-4 text-xs font-medium text-ink">⚠ {errorText}</p>}
      {currentStatus === "mastered" && (
        <p className="mt-4 rounded-xl border border-gold/30 bg-gold-soft p-3 text-xs text-gold">
          ★ Mastered — confirmed through the Adoption Log.
        </p>
      )}

      <p className="mt-5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">Also under this skill</p>
      {skill.otherItems.length > 0 ? (
        <div className="mt-2 flex flex-col gap-0.5">
          {skill.otherItems.map((it) => (
            <div
              key={it.key}
              className="flex items-center justify-between gap-2 border-t border-hairline py-2.5 text-xs first:border-t-0 first:pt-0"
            >
              <span className="text-ink">{it.title}</span>
              <span className="shrink-0 text-[11px] text-ink-faint">{it.timeLabel}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] text-ink-faint">Nothing else yet.</p>
      )}
      {skill.moreCount > 0 && <p className="mt-1 text-[11.5px] text-ink-faint">+ {skill.moreCount} more</p>}

      <a
        href={`/skills/${skill.slug}`}
        data-no-open
        className="mt-4 block w-full rounded-full border border-hairline-strong py-2.5 text-center text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
      >
        Open in Skill Map →
      </a>
    </>
  );
}

export interface ReelDetailProps {
  data: ReelDetailData;
  open: boolean;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onClose: () => void;
}

/**
 * T18.6 (§2.2): the push-transition Detail overlay. Always mounted (never
 * conditionally rendered) — Write-up being un-hideable means Detail always
 * has at least one tab, so the "don't open Detail if every tab would be
 * hidden" edge case from the pre-2026-07-25 spec is moot (see the epic
 * file's judgment call 2). Off-screen via `translate-x-full` when closed so
 * the slide-in transition has something to animate from; `duration-300`
 * (300ms) sits inside the binding 250-340ms window, and the project's global
 * `prefers-reduced-motion` guard (globals.css) neutralizes it for users who
 * asked for that, with no extra code needed here.
 */
export function ReelDetail({ data, open, activeTab, onSelectTab, onClose }: ReelDetailProps) {
  const visibleTabs = TAB_DEFS.filter((t) => t.id === "writeup" || !isTabEmpty(t.id, data));

  return (
    <div
      /* `fixed` + z-30, not `absolute`: the parent <article> is `relative`, so
         an absolutely-positioned overlay stacks only INSIDE that article and
         still paints beneath the fixed app bar (z-20, layout.tsx) and FilterBar
         (z-10) — which sit in a different stacking context. That made every
         control here unreachable: Back and all three tabs were covered, so
         Detail could be opened but never dismissed or navigated (a Playwright
         click() on Back timed out).

         Detail covers the shell chrome deliberately. The accepted prototype
         (docs/specs/prototypes/reel-card-and-detail.html) renders Detail as
         `absolute; inset: 0` filling the whole `.reel-slot` — which there IS
         the entire phone screen, with no app bar or filter bar outside it. The
         prototype therefore never had to say which wins; full-frame Detail is
         the faithful translation. Bottom inset leaves the tab bar visible, per
         ADR 0023's persistent-tab-bar rule. */
      className={`fixed inset-x-0 top-0 bottom-[var(--tabbar-h)] z-30 flex flex-col border-l border-hairline bg-ground transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 py-1 pr-1 text-xs text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true">‹</span> Back
        </button>
        <span className="truncate text-[11.5px] text-ink-faint">{data.title}</span>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-hairline px-4 pt-3">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTab(t.id)}
            className={`border-b-2 px-1 pb-2.5 pt-2 text-[12.5px] font-semibold ${
              activeTab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-faint hover:text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {visibleTabs.map((t) => (
          <div
            key={t.id}
            className={`absolute inset-0 overflow-y-auto px-4 py-4 ${activeTab === t.id ? "block" : "hidden"}`}
          >
            {t.id === "writeup" && <WriteupPanel data={data} />}
            {t.id === "context" && <ContextPanel data={data} />}
            {t.id === "skill" && <SkillPanel data={data} />}
          </div>
        ))}
      </div>
    </div>
  );
}
