import Link from "next/link";

/**
 * T18.13 (§10.6): the one back-affordance rule for every page that is not a
 * tab-bar destination (Today, Feed, Skills, Library — the four in
 * `TabBar.tsx`). Such a page always carries this link, first thing in its
 * content, to its logical parent surface — a static `href`, not
 * `router.back()`/browser history: several of these pages are reachable from
 * more than one place (e.g. `/clusters/[id]` from any reel card's
 * supersession notice, on either Today or Feed), so "go back to where the
 * link happened to render this page from" is not one consistent place, but
 * "go back to the surface this page belongs under" is. It also means the
 * link works identically on a fresh page load (e.g. someone opens the URL
 * directly, or shares it) where there is no browser history to go back to.
 *
 * Applied to: `/clusters/[id]` → Feed, `/skills/[slug]` → Skill Map,
 * `/experience/[id]/edit` and `/experience/new` → Experience, `/admin` →
 * Feed. `/admin/login` is deliberately exempted — it is an auth gate one
 * passes *through*, not a page with a parent surface to return to.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink">
      <span aria-hidden="true">←</span> Back to {label}
    </Link>
  );
}
