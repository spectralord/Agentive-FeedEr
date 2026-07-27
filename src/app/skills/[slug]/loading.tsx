import { BackLink } from "@/components/BackLink";
import { DetailHeaderSkeleton, ListSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/skills/[slug]` — a ring-shaped
 * outline (matching `SkillRing`, ADR 0016 point 2 — this skeleton is a
 * neutral placeholder, not a fourth ring implementation) plus row outlines
 * for "Associated content" and "Note history", matching `SkillNodeDetail.tsx`.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      <BackLink href="/skills" label="Skill Map" />
      <div className="mt-3">
        <SkeletonBar className="h-5 w-2/3" />
      </div>
      <div className="mt-5 rounded-lg border border-hairline bg-surface px-4 py-4">
        <DetailHeaderSkeleton withRing />
      </div>
      <div className="mt-6">
        <SkeletonBar className="h-3.5 w-40" />
        <div className="mt-2">
          <ListSkeleton rows={2} />
        </div>
      </div>
      <div className="mt-6">
        <SkeletonBar className="h-3.5 w-32" />
        <div className="mt-2">
          <ListSkeleton rows={2} />
        </div>
      </div>
    </div>
  );
}
