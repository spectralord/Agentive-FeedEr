import { HubSubnav, LIBRARY_ITEMS } from "@/components/HubSubnav";
import { ListSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/saved` — row outlines (not card
 * outlines; Saved is a plain list, see `SavedList.tsx`). The hub sub-nav is
 * real chrome (no per-request data, same links either way) so it renders
 * immediately instead of as a fake bar.
 */
export default function Loading() {
  return (
    <div className="pb-16 pt-4">
      <HubSubnav items={LIBRARY_ITEMS} activeHref="/saved" />
      <div className="mx-auto max-w-xl px-4">
        <SkeletonBar className="h-4 w-28" />
      </div>
      <div className="mt-3">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
