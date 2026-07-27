import { FeedCardSkeleton } from "@/components/skeletons";

/**
 * T18.8 (§10.2): route-level loading skeleton for the Feed (`/`). Every page
 * in this app is `force-dynamic` (fresh DB read per request), so without
 * this a navigation here was a silent round-trip. Shape matches the real
 * feed exactly: full-height snap cards, not a generic spinner. Height math
 * mirrors `page.tsx`'s own `-mt-[var(--header-h)] h-[calc(100dvh-var(--tabbar-h))]`
 * so nothing jumps once real content lands. `FilterBar` is `position: fixed`
 * and does not affect this container's own flow, so it is deliberately not
 * faked here (see the `/today` loading skeleton for a route where the nav
 * bar above the feed is faked, because there it visually anchors the page).
 */
export default function Loading() {
  return (
    <div className="feed -mt-[var(--header-h)] h-[calc(100dvh-var(--tabbar-h))] snap-y snap-mandatory overflow-hidden">
      <FeedCardSkeleton />
      <FeedCardSkeleton />
    </div>
  );
}
