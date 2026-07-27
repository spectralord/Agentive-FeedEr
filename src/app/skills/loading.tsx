import { HubSubnav } from "@/components/HubSubnav";
import { GridSkeleton, ListSkeleton, SkeletonBar } from "@/components/skeletons";

// Mirrors `skills/page.tsx`'s own (unexported, page-local) SKILLS_HUB_ITEMS —
// duplicated as a two-item literal rather than importing across page.tsx
// module boundaries.
const SKILLS_HUB_ITEMS = [
  { href: "#skill-map", label: "Map" },
  { href: "#adoption-log", label: "Adoption Log" },
];

/**
 * T18.8 (§10.2): loading skeleton for `/skills` — grid-tile outlines for the
 * Skill Map (matching `SkillMap.tsx`'s ring+label tiles) and row outlines
 * for the Adoption Log, under their own heading outlines. No pending-
 * proposals outline: that section is empty far more often than not, so a
 * generic guess there would be more likely wrong than helpful.
 */
export default function Loading() {
  return (
    <>
      <HubSubnav items={SKILLS_HUB_ITEMS} />
      <div className="mx-auto max-w-xl px-4 py-6">
        <SkeletonBar className="h-5 w-32" />

        <div className="mt-10">
          <SkeletonBar className="h-3.5 w-24" />
          <div className="mt-4">
            <GridSkeleton tiles={6} />
          </div>
        </div>

        <div className="mt-10">
          <SkeletonBar className="h-3.5 w-32" />
          <div className="mt-4">
            <ListSkeleton rows={3} />
          </div>
        </div>
      </div>
    </>
  );
}
