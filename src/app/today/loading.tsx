import { FeedCardSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/today` — same snap-card shape as the
 * main feed, plus an outline for the "Important today (N)" nav bar sitting
 * above it (`today/page.tsx`'s own `fixed inset-x-0 top-[var(--header-h)]`
 * bar), since that bar carries real per-request data (the count) rather
 * than being static chrome.
 */
export default function Loading() {
  return (
    <>
      <div className="fixed inset-x-0 top-[var(--header-h)] z-10 border-b border-hairline bg-ground/70 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBar className="h-3 w-16" />
        </div>
      </div>
      <div className="feed -mt-[var(--header-h)] h-[calc(100dvh-var(--tabbar-h))] snap-y snap-mandatory overflow-hidden">
        <FeedCardSkeleton />
        <FeedCardSkeleton />
      </div>
    </>
  );
}
