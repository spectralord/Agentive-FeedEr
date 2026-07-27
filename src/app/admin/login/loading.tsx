import { FormFieldSkeleton, SkeletonBar } from "@/components/skeletons";

/**
 * T18.8 (§10.2): loading skeleton for `/admin/login` — a single field +
 * button outline, matching the real login form's small shape.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-sm flex-col justify-center gap-4 px-6">
      <SkeletonBar className="h-5 w-24" />
      <FormFieldSkeleton />
      <SkeletonBar className="h-9 w-24 rounded-full" />
    </div>
  );
}
