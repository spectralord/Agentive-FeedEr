"use client";

import { useEffect, useState } from "react";
import type { DisplayStatus } from "@/lib/skills/progress";

/**
 * ADR 0016 point 2 / T18.5 (§5.1): the ONE status-ring component, reused by
 * the `/skills` grid tile, the `/skills/[slug]` detail header, and (T18.7,
 * later) the Reel Detail Skill tab. No call site re-invents this.
 *
 * Geometry matches both prototypes: r=21, dash=2πr, 52×52 viewBox,
 * stroke-width 4, mastered = full arc + ★.
 *
 * **Four-rung progression, per `docs/specs/prototypes/skill-constellation.html`'s
 * `ringSvg()` (line ~438) — that is the binding prototype for §5.1** (see
 * `docs/specs/prototypes/README.md`'s file/section table), and it is the only
 * one that knows about a fourth state:
 *   untouched 0 · seen .33 · tried .66 · mastered 1 (+★)
 * `reel-card-and-detail.html`'s ring predates the fourth state and has only
 * three rungs (seen at frac 0); where the two disagree the constellation wins
 * here, and it is also the superset. Collapsing untouched and seen to both be
 * frac-0 would defeat the point of T18.4/§9.4 ("restores meaning to the bottom
 * rung of the ring") — the constellation ships an explicit
 * "Untouched — tagged, never opened" legend entry precisely because it is meant
 * to read as its own visible state.
 */

const BASE_SIZE = 52;
const BASE_RADIUS = 21;
const BASE_STROKE_WIDTH = 4;

interface RingConfig {
  frac: number;
  trackColor: string;
  fillColor: string | null;
  glyph: string;
}

const RING_CONFIG: Record<DisplayStatus, RingConfig> = {
  untouched: { frac: 0, trackColor: "var(--color-hairline-strong)", fillColor: null, glyph: "" },
  seen: { frac: 0.33, trackColor: "var(--color-hairline)", fillColor: "var(--color-ink-muted)", glyph: "" },
  tried: { frac: 0.66, trackColor: "var(--color-hairline)", fillColor: "var(--color-accent)", glyph: "" },
  mastered: { frac: 1, trackColor: "var(--color-hairline)", fillColor: "var(--color-gold)", glyph: "★" },
};

export interface SkillRingProps {
  status: DisplayStatus;
  /**
   * Pass only immediately after a status change (the status the node had a
   * moment ago) to play the one quiet ring-fill animation (§5.1's
   * "level-up feel, deliberately not kitsch"). Omit on every ordinary page
   * view — the ring must never loop, pulse, or replay just from being
   * looked at again.
   */
  previousStatus?: DisplayStatus;
  /** Pixel diameter. Defaults to the prototype's 52px (detail header /
   *  skill tab); grid tiles pass a smaller value. */
  size?: number;
  className?: string;
}

export function SkillRing({ status, previousStatus, size = BASE_SIZE, className }: SkillRingProps) {
  const shouldAnimate = previousStatus !== undefined && previousStatus !== status;
  const [displayed, setDisplayed] = useState<DisplayStatus>(shouldAnimate ? previousStatus : status);

  useEffect(() => {
    if (!shouldAnimate) return;
    // One frame so the initial (previous-status) paint actually commits
    // before we flip to the target — otherwise the browser may coalesce
    // both states into a single paint and there's nothing to transition.
    const raf = requestAnimationFrame(() => setDisplayed(status));
    // Strip the `?from=` query param that triggered this once the
    // animation has had time to play, so refreshing the same URL later
    // never replays it. Plain history API — no router/new dependency.
    const clearParam = window.setTimeout(() => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (!url.searchParams.has("from")) return;
      url.searchParams.delete("from");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, 340);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clearParam);
    };
    // Runs once on mount only, by design: this component instance exists
    // for exactly one status transition (the page that renders it is
    // freshly loaded after the mutating redirect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = RING_CONFIG[displayed];
  const scale = size / BASE_SIZE;
  const radius = BASE_RADIUS * scale;
  const strokeWidth = BASE_STROKE_WIDTH * scale;
  const dash = 2 * Math.PI * radius;
  const offset = dash - dash * cfg.frac;
  const center = size / 2;

  return (
    <div
      className={`relative inline-block shrink-0${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={cfg.trackColor} strokeWidth={strokeWidth} />
        {cfg.fillColor && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={cfg.fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dash.toFixed(1)}
            strokeDashoffset={offset.toFixed(1)}
            className="transition-[stroke-dashoffset,stroke] duration-300 ease-out"
          />
        )}
      </svg>
      {cfg.glyph && (
        <span
          className="absolute inset-0 grid place-items-center text-gold"
          style={{ fontSize: Math.round(size * 0.29) }}
          aria-hidden="true"
        >
          {cfg.glyph}
        </span>
      )}
    </div>
  );
}
