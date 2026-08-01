"use client";

import { useState } from "react";

/**
 * T20.4 (ADR 0019, design doc §8.4): the ONE tick control, shared by the
 * Reel Detail Skill tab (`ReelDetail.tsx`) and the node page's To-Try list
 * (`SkillNodeDetail.tsx`) — both render this exact component rather than
 * each hand-rolling their own `fetch` to the toggle route. §8.4's rule is
 * "one shared mutation, two call sites, never two implementations"; sharing
 * the component itself (not just the route) is the stronger, harder-to-drift
 * version of that rule — a future edit to the optimistic-update/error-revert
 * logic only has one place to happen.
 *
 * POSTs to `/api/actionables/[reelId]/toggle`, the one HTTP entry point for
 * `toggleActionable`. Optimistic: flips immediately, reverts with a visible
 * inline note on failure. Two distinct callbacks, both optional:
 * `onToggled(done)` fires on every successful toggle either direction (for
 * bookkeeping like the node page's evidence count); `onCompleted` fires only
 * on a fresh 0->1 completion, never on untoggle — callers use it to offer a
 * one-time, dismissible suggestion, never an automatic write (ADR 0019's
 * resolved open question).
 */
export interface ActionableTickProps {
  reelId: number;
  initialDone: boolean;
  onCompleted?: () => void;
  onToggled?: (done: boolean) => void;
  /** "compact" (default) matches the Reel Detail action box; "row" is a
   *  smaller inline variant for the node page's list rows. Presentation
   *  only — the mutation and its call shape are identical either way. */
  variant?: "compact" | "row";
}

export function ActionableTick({
  reelId,
  initialDone,
  onCompleted,
  onToggled,
  variant = "compact",
}: ActionableTickProps) {
  const [done, setDone] = useState(initialDone);
  const [pending, setPending] = useState(false);
  const [errored, setErrored] = useState(false);

  async function handleToggle() {
    const optimistic = !done;
    setPending(true);
    setErrored(false);
    setDone(optimistic);

    let ok = false;
    try {
      const res = await fetch(`/api/actionables/${reelId}/toggle`, { method: "POST" });
      ok = res.ok;
    } catch {
      ok = false;
    }

    setPending(false);
    if (!ok) {
      setDone(!optimistic);
      setErrored(true);
      return;
    }
    onToggled?.(optimistic);
    if (optimistic) onCompleted?.();
  }

  const checkbox = (
    <span
      aria-hidden="true"
      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] leading-none ${
        done ? "border-ground bg-ground text-action" : "border-action/60 text-transparent"
      }`}
    >
      ✓
    </span>
  );

  if (variant === "row") {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          // Touch target >= 40px on both axes (ReelActions.tsx pattern),
          // even though this variant sits in a compact row.
          className={`grid min-h-10 min-w-10 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            done ? "border-action bg-action" : "border-action/40 bg-transparent hover:bg-action-soft"
          }`}
        >
          <span
            aria-hidden="true"
            className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] leading-none ${
              done ? "border-ground bg-ground text-action" : "border-action/60 text-transparent"
            }`}
          >
            ✓
          </span>
        </button>
        {errored && <p className="mt-1 text-[10px] text-ink-muted">Failed — retry</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={done}
        // Touch target >= 40px (ReelActions.tsx pattern) — min-h-10 with
        // generous horizontal padding since this carries a label, not just
        // an icon.
        className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          done
            ? "border-action bg-action text-ground"
            : "border-action/40 bg-transparent text-action hover:bg-action-soft"
        }`}
      >
        {checkbox}
        {done ? "Done" : "Mark as done"}
      </button>
      {errored && <p className="mt-1.5 text-[11px] text-ink-muted">Couldn&apos;t save — try again.</p>}
    </div>
  );
}
