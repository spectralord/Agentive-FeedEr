import { FRESHNESS_STALE_MS } from "./pipeline";
import { formatRelativeTime } from "./relativeTime";

export interface FreshnessInfo {
  /** e.g. "updated 3 hours ago" or "no successful run yet". */
  label: string;
  /** True once past `FRESHNESS_STALE_MS`, or if no run has ever succeeded. */
  stale: boolean;
}

/**
 * T18.11 (§10.3): pure display logic for the app-bar freshness indicator,
 * split out from the DB query (`getLatestSuccessfulRunFinishedAt` in
 * `pipeline.ts`) so the escalation threshold is unit-testable without
 * Postgres.
 *
 * ADR 0016 reserves `--caution` for the caveat/freshness-*supersession*
 * notice only — reusing it here for "pipeline is stale" would give it a
 * second, unrelated meaning, exactly the drift ADR 0016 point 1 forbids.
 * `--action` (already used for the sourced Action line, skill badge, and
 * "mark as tried") is equally off-limits for the same reason, even though
 * the accepted prototype's own CSS happens to paint its "led" dot with
 * `--action` — the prototype is binding for *layout/look*, not for a second
 * meaning on an ADR 0016 reserved color. So the escalation from "normal" to
 * "stale" is salience-only, not color-coded as an alarm: `ink-muted`/
 * `ink-faint` (quiet, healthy) vs. plain `ink` (brighter, more prominent) —
 * both neutral tokens, no reserved color spent on either state.
 */
export function getFreshnessInfo(finishedAt: Date | null, now: Date = new Date()): FreshnessInfo {
  if (finishedAt === null) {
    return { label: "no successful run yet", stale: true };
  }
  const stale = now.getTime() - finishedAt.getTime() > FRESHNESS_STALE_MS;
  return { label: `updated ${formatRelativeTime(finishedAt, now)}`, stale };
}
