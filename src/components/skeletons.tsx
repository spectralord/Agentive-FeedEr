/**
 * T18.8 (§10.2): shared skeleton primitives for route-level `loading.tsx`
 * files. Each route composes these into an outline that matches its own
 * surface (card outlines for the feed, row outlines for lists, tile
 * outlines for the Skills grid, field outlines for forms) — never one
 * generic spinner everywhere.
 *
 * Plain Server Components: purely presentational, no interactivity needed.
 * `animate-pulse` is a stock Tailwind utility (no new dependency); the T18.1
 * global `@media (prefers-reduced-motion: reduce)` guard already neutralizes
 * `animation-duration`/`animation-iteration-count`, so reduced-motion users
 * get a static (non-pulsing) outline for free, no extra code here.
 *
 * Token-only, neutral colors: `bg-surface-raised`/`border-hairline`. Never
 * `--gold` or `--caution` (ADR 0016 — a loading skeleton is not a mastered
 * or caveat/supersession signal).
 */

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-raised ${className}`} />;
}

export function SkeletonCircle({ size }: { size: number }) {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 animate-pulse rounded-full bg-surface-raised"
      style={{ width: size, height: size }}
    />
  );
}

/** One reel-card-shaped outline: meta row, badge row, title, summary lines.
 *  Sized/positioned like a real feed card (`ReelCardBody`'s snap section) so
 *  swapping in real content doesn't jump. */
export function FeedCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="reel flex h-[calc(100dvh-var(--tabbar-h))] w-full shrink-0 snap-start flex-col justify-center gap-4 px-6 [scroll-snap-stop:always]"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="ml-auto h-6 w-10" />
          <SkeletonBar className="h-6 w-10" />
        </div>
        <div className="flex gap-1.5">
          <SkeletonBar className="h-5 w-14 rounded-full" />
          <SkeletonBar className="h-5 w-16 rounded-full" />
          <SkeletonBar className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonBar className="h-5 w-4/5" />
        <div className="flex flex-col gap-2">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/** One list-row-shaped outline (Saved/Experience/History's compact rows). */
export function RowSkeleton() {
  return (
    <li aria-hidden="true" className="flex flex-col gap-1.5 py-3">
      <SkeletonBar className="h-3 w-32" />
      <div className="flex gap-1.5">
        <SkeletonBar className="h-4 w-14 rounded-full" />
        <SkeletonBar className="h-4 w-16 rounded-full" />
      </div>
      <SkeletonBar className="h-4 w-3/4" />
    </li>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ol className="mx-auto flex max-w-xl flex-col divide-y divide-hairline px-4">
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </ol>
  );
}

/** One grid-tile-shaped outline (ring + two label bars) for the Skills grid. */
export function GridTileSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-3"
    >
      <SkeletonCircle size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <SkeletonBar className="h-3.5 w-3/4" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function GridSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: tiles }, (_, i) => (
        <GridTileSkeleton key={i} />
      ))}
    </div>
  );
}

/** A detail-header-shaped outline: title bar + meta-badge row (+ optional
 *  ring circle, for the Skill node header). */
export function DetailHeaderSkeleton({ withRing = false }: { withRing?: boolean }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      {withRing && <SkeletonCircle size={52} />}
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonBar className="h-5 w-2/3" />
        <div className="flex gap-2">
          <SkeletonBar className="h-4 w-16 rounded-full" />
          <SkeletonBar className="h-4 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A labeled-field-shaped outline, for form pages (new/edit/login). */
export function FormFieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1.5">
      <SkeletonBar className="h-3 w-20" />
      <SkeletonBar className={tall ? "h-24 w-full" : "h-9 w-full"} />
    </div>
  );
}
