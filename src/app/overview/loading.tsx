import { HubSubnav, LIBRARY_ITEMS } from "@/components/HubSubnav";
import { ListSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/overview` (Archive) — two stacked
 * list-row outlines, one for the SOTA section and one for History, each
 * under its own heading outline, matching `SotaSection.tsx`/`HistoryList.tsx`.
 */
export default function Loading() {
  return (
    <div className="pb-16">
      <HubSubnav items={LIBRARY_ITEMS} activeHref="/overview" />
      <div className="mx-auto max-w-xl px-4 pt-6">
        <SkeletonBar className="h-4 w-48" />
      </div>
      <div className="mt-3">
        <ListSkeleton rows={3} />
      </div>

      <div className="mx-auto mt-8 max-w-xl border-t border-hairline px-4 pt-4">
        <SkeletonBar className="h-4 w-28" />
      </div>
      <div className="mx-auto flex max-w-xl gap-1.5 px-4 py-2">
        <SkeletonBar className="h-6 w-16 rounded-full" />
        <SkeletonBar className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-2">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
