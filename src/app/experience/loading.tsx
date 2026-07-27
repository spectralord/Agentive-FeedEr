import { HubSubnav, LIBRARY_ITEMS } from "@/components/HubSubnav";
import { ListSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/experience` — row outlines matching
 * `ExperienceList.tsx`, plus outlines for the heading/"+ New report" button
 * and the filter bar above the list.
 */
export default function Loading() {
  return (
    <div className="pb-16">
      <HubSubnav items={LIBRARY_ITEMS} activeHref="/experience" />
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 pt-4">
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-7 w-24 rounded-full" />
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
