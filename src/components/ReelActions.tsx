"use client";

import { useState } from "react";
import type { InteractionType, ReelActionFlags } from "@/lib/interactions";

interface ReelActionsProps {
  reelId: number;
  initial: ReelActionFlags;
  /** Called once the hide request succeeds — parent removes the card. */
  onHidden: () => void;
}

async function postInteraction(reelId: number, type: InteractionType): Promise<boolean | null> {
  try {
    const res = await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId, type }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { active: boolean };
    return data.active;
  } catch {
    return null;
  }
}

// T18.3 (§3): restyled onto the token system — inactive = surface-raised/
// ink-muted, active = ink/ground. Semantics unchanged; this bar's job is
// small and already right, so this is styling only, no functional change.
function actionButtonClass(active: boolean): string {
  return `rounded-full px-2.5 py-1.5 text-sm leading-none transition-colors ${
    active ? "bg-ink text-ground" : "bg-surface-raised text-ink-muted hover:bg-hairline-strong"
  }`;
}

type ToggleType = "save" | "up" | "down";

/**
 * Subtle client action bar (T6.2): 🔖 save · 👍 up · 👎 down · 🙈 hide.
 * Optimistic UI — button state flips immediately and reverts if the request
 * fails; no full page reload. Hide additionally tells the parent to remove
 * this card from view right away (the server-side exclusion from getReels is
 * what makes it stay gone on the next request).
 */
export function ReelActions({ reelId, initial, onHidden }: ReelActionsProps) {
  const [flags, setFlags] = useState<ReelActionFlags>(initial);
  const [hiding, setHiding] = useState(false);

  async function toggle(type: ToggleType) {
    const optimistic = !flags[type];
    setFlags((f) => ({ ...f, [type]: optimistic }));
    const active = await postInteraction(reelId, type);
    if (active === null) {
      setFlags((f) => ({ ...f, [type]: !optimistic })); // revert on failure
    }
  }

  async function handleHide() {
    setHiding(true);
    const active = await postInteraction(reelId, "hide");
    if (active === null) {
      setHiding(false);
      return;
    }
    onHidden();
  }

  return (
    <div className="flex items-center gap-1.5" aria-label="Actions">
      <button
        type="button"
        aria-pressed={flags.save}
        aria-label="Save"
        title="Save"
        onClick={() => toggle("save")}
        className={actionButtonClass(flags.save)}
      >
        🔖
      </button>
      <button
        type="button"
        aria-pressed={flags.up}
        aria-label="Like"
        title="Like"
        onClick={() => toggle("up")}
        className={actionButtonClass(flags.up)}
      >
        👍
      </button>
      <button
        type="button"
        aria-pressed={flags.down}
        aria-label="Dislike"
        title="Dislike"
        onClick={() => toggle("down")}
        className={actionButtonClass(flags.down)}
      >
        👎
      </button>
      <button
        type="button"
        disabled={hiding}
        aria-label="Hide"
        title="Hide"
        onClick={handleHide}
        className={actionButtonClass(false)}
      >
        🙈
      </button>
    </div>
  );
}
