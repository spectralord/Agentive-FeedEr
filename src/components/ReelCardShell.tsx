"use client";

import { useRef, useState } from "react";
import type { ReelActionFlags } from "@/lib/interactions";
import { ReelActions } from "./ReelActions";
import { ReelDetail, type TabId } from "./ReelDetail";
import type { ReelDetailData } from "./reelDetailData";

interface ReelCardShellProps {
  reelId: number;
  initial: ReelActionFlags;
  children: React.ReactNode;
  /** T18.6: the Detail overlay's tab data, built server-side by
   *  `buildReelDetailData` (see reelDetailData.ts) from the same `FeedReel`
   *  `children` was rendered from. */
  detail: ReelDetailData;
}

// T18.6 (§2.3): ignore touch-starts within this many px of either screen
// edge before treating a horizontal drag as the open/close gesture — the
// mitigation against iOS Safari's edge-swipe-back the product owner accepted
// swipe-right-to-open against. Matches
// docs/specs/prototypes/reel-card-and-detail.html's EDGE constant exactly.
const EDGE_DEAD_ZONE = 24;
const SWIPE_MIN_DISTANCE = 50;
const SWIPE_DIRECTION_RATIO = 1.4;

/**
 * Wraps one reel card with the hide-to-remove behaviour (T6.2) and, since
 * T18.6, the Compact <-> Detail push navigation (§2.2/§2.3): open/active-tab
 * state, the tap-to-open handler on Compact's content, and the swipe
 * gesture (with the edge dead-zone mitigation) live here because both need
 * the same state as the hide button already did — one client boundary for
 * "everything this card's frame does", same as before.
 */
export function ReelCardShell({ reelId, initial, children, detail }: ReelCardShellProps) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("writeup");
  const articleRef = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (hidden) return null;

  function openDetail(tab: TabId) {
    setActiveTab(tab);
    setOpen(true);
  }

  // §2.3: tap anywhere on Compact's content opens Detail on its first tab
  // (always Write-up — never hidden). `data-no-open` marks Compact's own
  // interactive elements (currently: the "Confirm superseded" form) that
  // must keep working unmolested rather than also triggering this; T18.7's
  // `data-open-skill` (the skill badge) will add the "jump straight to the
  // Skill tab" branch below.
  function handleCompactClick(e: React.MouseEvent<HTMLDivElement>) {
    if (open) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-open]")) return;
    if (target.closest("[data-open-skill]")) {
      openDetail("skill");
      return;
    }
    openDetail("writeup");
  }

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    const width = articleRef.current?.clientWidth ?? 0;
    const x = e.touches[0].clientX;
    if (x < EDGE_DEAD_ZONE || x > width - EDGE_DEAD_ZONE) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x, y: e.touches[0].clientY };
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
      if (dx > 0 && !open) openDetail("writeup"); // swipe right opens Detail
      else if (dx < 0 && open) setOpen(false); // swipe left closes back to Compact
    }
  }

  return (
    <article
      ref={articleRef}
      className="reel relative min-h-dvh snap-start [scroll-snap-stop:always]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        onClick={handleCompactClick}
        aria-hidden={open}
        className={`absolute inset-0 transition-transform duration-300 ease-out ${
          open ? "pointer-events-none -translate-x-[28%]" : "translate-x-0"
        }`}
      >
        {children}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
        <div className="pointer-events-auto flex w-full max-w-xl justify-end">
          <ReelActions reelId={reelId} initial={initial} onHidden={() => setHidden(true)} />
        </div>
      </div>

      <ReelDetail
        data={detail}
        open={open}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onClose={() => setOpen(false)}
      />
    </article>
  );
}
