import { BackLink } from "@/components/BackLink";
import { ListSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/admin` — an ops surface, so a
 * simpler row-outline treatment (stat row + two lists: recent runs, source
 * error counts) is enough; it is not part of the core mobile flow the other
 * skeletons are tuned for.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <BackLink href="/" label="Feed" />
      <div className="mt-3">
        <SkeletonBar className="h-5 w-24" />
      </div>
      <div className="mt-4 flex gap-3">
        <SkeletonBar className="h-10 w-20 rounded-lg" />
        <SkeletonBar className="h-10 w-20 rounded-lg" />
        <SkeletonBar className="h-10 w-20 rounded-lg" />
      </div>
      <div className="mt-6">
        <SkeletonBar className="h-3.5 w-32" />
        <div className="mt-2">
          <ListSkeleton rows={3} />
        </div>
      </div>
      <div className="mt-6">
        <SkeletonBar className="h-3.5 w-32" />
        <div className="mt-2">
          <ListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
