import { BackLink } from "@/components/BackLink";
import { FormFieldSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/experience/new` — form-field
 * outlines (title, body, checkbox row, submit button), matching the real
 * form's shape rather than a spinner. `BackLink` carries no per-request
 * data, so it renders as the real, already-working link immediately.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      <BackLink href="/experience" label="Experience" />
      <div className="mt-2">
        <SkeletonBar className="h-4 w-28" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <FormFieldSkeleton />
        <FormFieldSkeleton tall />
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="mt-2 h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}
