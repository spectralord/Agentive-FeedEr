import { BackLink } from "@/components/BackLink";
import { DetailHeaderSkeleton, ListSkeleton } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/clusters/[id]` — title/meta outline
 * plus row outlines for the member-reels list, matching `clusters/[id]/page.tsx`.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <BackLink href="/" label="Feed" />
      <div className="mt-4">
        <DetailHeaderSkeleton />
      </div>
      <div className="mt-4">
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}
