"use client";

import { useEffect } from "react";

/**
 * T18.8 (§10.2): root-level error boundary. Catches an error thrown while
 * rendering any `page.tsx` below the root layout — none of the 12 routes
 * define a more specific `error.tsx` of their own, so this is the one
 * boundary for all of them. The header/tab bar keep rendering underneath:
 * Next only swaps out `layout.tsx`'s `{children}`, not the layout itself
 * (a segment's own `error.tsx` never catches errors thrown by that same
 * segment's `layout.tsx` — only by its `page.tsx`/children — which is
 * exactly what we want here).
 *
 * Must be a Client Component (Next requirement) so `reset()` can re-render
 * the segment and retry, instead of a full page reload.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--tabbar-h))] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium text-ink">Something went wrong</p>
      <p className="text-sm text-ink-muted">
        This page hit an error loading its data. Nothing was lost — try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full border border-hairline-strong bg-surface-raised px-4 py-2 text-sm text-ink transition-colors hover:bg-hairline"
      >
        Try again
      </button>
    </div>
  );
}
