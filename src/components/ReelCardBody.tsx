import type { FeedReel } from "@/lib/feed";
import { isNew } from "@/lib/labels";
import { formatRelativeTime } from "@/lib/relativeTime";
import { CATEGORY_LABELS, CONFIDENCE_LABELS, MATURITY_LABELS } from "./labels";

/**
 * T18.7: split out of `ReelCard.tsx` into its own file. `ReelCardBody` is
 * imported directly by `ReelStackCard.tsx`, which is a Client Component
 * (`"use client"`, for its show/hide-sources toggle) — keeping this file free
 * of any import that reaches `src/lib/skills/reelSkillTab.ts` (DB-touching,
 * for the Skill tab's data) matters: `ReelCard.tsx` itself now imports
 * `buildReelDetailData` (which does reach that module), and Next.js bundles
 * a plain (no "use client") module's *entire* import graph into the client
 * bundle once it's reached from a Client Component — so `ReelStackCard.tsx`
 * must import `ReelCardBody` from here, never from `./ReelCard`, or `next
 * build` fails trying to resolve Node builtins (`tls`, `util/types`) that
 * `pg` needs, inside the browser bundle.
 */

/** Plain neutral chip — category/maturity/experimental/New. Everything in the
 *  badge row is this style except the confidence tick and the skill badge
 *  (ADR 0016: skill is the only colored badge). */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-ink-muted">
      {children}
    </span>
  );
}

/** Epic 11 (ADR 0012, T11.5) corroboration scale — a subtly different
 *  treatment from the plain chips above (design doc §2.1: "a small dot-tick
 *  instead of plain text") so it doesn't read as just another category.
 *  Outline-only (no fill), plus a leading dot; still neutral ink-muted, not
 *  one of the four reserved colors. */
function ConfidenceBadge({ confidence }: { confidence: "few" | "some" | "strong" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong px-2 py-0.5 font-mono text-[10px] text-ink-muted">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-muted" />
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

/** T18.2 (§7 #4): reel.skill, assigned by SkillTagger since Epic 12, rendered
 *  nowhere until now. The only colored badge in the row (--action, ADR 0016)
 *  — doubles as topic tag and "there's a skill to grow here" signal.
 *  T18.7: `data-open-skill` is the hook `ReelCardShell`'s tap handler looks
 *  for to jump straight to the Skill tab instead of Write-up (a shortcut,
 *  not a duplicate path) — matches the prototype's `data-action="open-skill"`. */
function SkillBadge({ skill }: { skill: string }) {
  return (
    <span
      data-open-skill
      className="cursor-pointer rounded-full border border-action/35 bg-action-soft px-2 py-0.5 font-mono text-[10px] text-action"
    >
      {skill}
    </span>
  );
}

/** T18.2 (§7 #3): R/Q move from the footer to the header so they're visible
 *  the instant the card is on screen, not just after scrolling to the
 *  footer. Two-line label + bar per row, matching
 *  docs/specs/prototypes/reel-card-and-detail.html's `.score-mini` exactly
 *  (bar-only, no literal numbers — `title`/`aria-label` carry the number for
 *  accessibility without changing the look). */
function ScoreMini({ relevance, quality }: { relevance: number; quality: number }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div
        className="flex items-center gap-1.5"
        title={`Relevance ${relevance}/100`}
        aria-label={`Relevance score ${relevance} of 100`}
      >
        <span className="w-[8px] text-right font-mono text-[9px] text-ink-faint">R</span>
        <div className="h-[3px] w-[34px] overflow-hidden rounded-sm bg-hairline">
          <span className="block h-full bg-accent" style={{ width: `${relevance}%` }} />
        </div>
      </div>
      <div
        className="flex items-center gap-1.5"
        title={`Quality ${quality}/100`}
        aria-label={`Quality score ${quality} of 100`}
      >
        <span className="w-[8px] text-right font-mono text-[9px] text-ink-faint">Q</span>
        <div className="h-[3px] w-[34px] overflow-hidden rounded-sm bg-hairline">
          <span className="block h-full bg-ink-muted" style={{ width: `${quality}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * The reel's Compact content — meta row/badges/title/summary. Shared between
 * a plain solo card (`ReelCard`) and the "N sources on this topic" stack
 * card (`ReelStackCard`, Epic 15 T15.4/T15.5), which renders this unchanged
 * for the cluster's primary reel plus its own banner slot on top.
 *
 * T18.2 (§2.1, ADR 0016 tokens): restyled onto the token system; scores moved
 * here from the footer; reel.skill now rendered as the badge row's one
 * colored badge; the Action block (reel.action + effortTag) is REMOVED —
 * it resurfaces in the Reel Detail's Skill tab in T18.7, next to the skill it
 * advances, not here.
 *
 * T18.6: `example` and the "View source" footer link — kept here as a
 * deliberate temporary deviation by T18.2, see that task's Abweichungen —
 * are now REMOVED and moved into the Reel Detail's Write-up tab
 * (`ReelDetail.tsx`'s `WriteupPanel`), discharging that deviation. Compact is
 * now exactly `docs/specs/prototypes/reel-card-and-detail.html`'s
 * `compactHtml()`: meta row -> badge row -> title -> summary, plus the
 * caveat marker and freshness notice (neither of which compactHtml() has,
 * both pre-date this file and are explicitly kept per §2.1/Epic 10/11). The
 * `tap-hint` line is new in T18.6 — compactHtml() has one too, and since
 * tap-to-open is brand-new behaviour as of this task, a discoverability
 * affordance earns its keep (flagged for review, since the epic's own
 * enumerated Compact composition doesn't explicitly list it).
 */
export function ReelCardBody({
  reel,
  stackBanner,
  newDays,
}: {
  reel: FeedReel;
  stackBanner?: React.ReactNode;
  /** env().NEW_DAYS, resolved by a Server Component and passed down. This
   *  component is reached from the client bundle via `ReelStackCard`, so it
   *  must never read `env()` itself — see `isNew`'s doc comment. */
  newDays: number;
}) {
  const showNewBadge = isNew(reel, new Date(), newDays);

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col overflow-y-auto px-6 pb-20 pt-[calc(var(--header-h)+var(--filterbar-h))]">
      {stackBanner}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-ink-muted">{reel.sourceName}</span>
          <span aria-hidden="true" className="text-ink-faint">
            ·
          </span>
          <time dateTime={reel.publishedAt.toISOString()} className="text-ink-faint">
            {formatRelativeTime(reel.publishedAt)}
          </time>
        </div>
        <ScoreMini relevance={reel.relevanceScore} quality={reel.qualityScore} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge>{CATEGORY_LABELS[reel.category]}</Badge>
        <Badge>{MATURITY_LABELS[reel.maturity]}</Badge>
        {reel.experimental && <Badge>🧪 experimental</Badge>}
        {showNewBadge && <Badge>🆕 New</Badge>}
        {reel.confidence && <ConfidenceBadge confidence={reel.confidence} />}
        {reel.skill && <SkillBadge skill={reel.skill} />}
      </div>

      <h2 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-ink">
        {reel.title}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{reel.summary}</p>

      {/* Epic 10 (ADR 0011, T10.4) caveat — T18.2 judgment call 1: minimal
          --caution marker only in Compact. The full text moves to the
          Context tab (T18.6). Never affects quality_score (ADR 0004) —
          display-layer only. */}
      {reel.caveat && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-caution">
          <span aria-hidden="true">⚠</span>
          <span>Caveat noted</span>
        </p>
      )}

      {/* Epic 11 (ADR 0012/0008, T11.5): freshness/supersession proposal —
          restyled onto --caution, structurally unchanged (link + "Confirm
          superseded" form). Only visible while lifecycleState is still
          "active". */}
      {/* T18.6 (§2.3): data-no-open — this block's link/form must keep
          working untouched by the new tap-to-open-Detail handler in
          ReelCardShell, which otherwise treats any click on Compact's
          content as "open Detail". */}
      {reel.supersededByClusterId !== null && reel.lifecycleState === "active" && (
        <div className="mt-3 rounded-lg border border-caution/30 bg-caution/10 p-3" data-no-open>
          <p className="text-sm text-caution">
            🕓 Newer available{reel.supersedeReason ? `: ${reel.supersedeReason}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <a
              href={`/clusters/${reel.supersededByClusterId}`}
              className="text-xs text-caution underline decoration-caution/50 underline-offset-2 hover:brightness-110"
            >
              View newer cluster
            </a>
            <form method="post" action={`/clusters/${reel.topicClusterId}/deprecate`}>
              <button
                type="submit"
                className="rounded-full border border-caution/50 px-3 py-1 text-xs text-caution transition-colors hover:bg-caution/10"
              >
                Confirm superseded
              </button>
            </form>
          </div>
        </div>
      )}

      {/* T18.6 (§2.3): tap-anywhere-on-Compact-opens-Detail is new as of this
          task — a discoverability hint, matching compactHtml()'s own
          `.tap-hint` line (see the doc comment above). */}
      <p className="mt-auto pt-6 text-center font-mono text-[10px] tracking-wide text-ink-faint">
        tap for details →
      </p>
    </div>
  );
}
