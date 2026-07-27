import Link from "next/link";

/**
 * T18.8 (§10.2): root-level not-found boundary. `notFound()` bubbles up to
 * the nearest `not-found.tsx` above the call site; none of the 12 routes
 * define their own, so this one file covers both existing call sites
 * (`/clusters/[id]`, `/skills/[slug]`, Epic 11/7) and any future one.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium text-ink">Page not found</p>
      <p className="text-sm text-ink-muted">There&apos;s nothing here.</p>
      <Link
        href="/"
        className="rounded-full border border-hairline-strong bg-surface-raised px-4 py-2 text-sm text-ink transition-colors hover:bg-hairline"
      >
        Back to Feed
      </Link>
    </div>
  );
}
