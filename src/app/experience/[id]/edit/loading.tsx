import { BackLink } from "@/components/BackLink";
import { FormFieldSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/experience/[id]/edit` — identical
 * form-field shape to `/experience/new` (same underlying form), since this
 * page also has to fetch the report from the DB before it can prefill it.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      <BackLink href="/experience" label="Experience" />
      <div className="mt-2">
        <SkeletonBar className="h-4 w-24" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <FormFieldSkeleton />
        <FormFieldSkeleton tall />
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="mt-2 h-9 w-20 rounded-full" />
      </div>
    </div>
  );
}
