import Link from "next/link";

export interface HubSubnavItem {
  href: string;
  label: string;
}

/**
 * T18.10 (§10.1, ADR 0023 consequences): the segmented sub-nav inside a hub
 * tab — Skills (Map · Adoption Log; Knowledge Base deliberately omitted, see
 * the epic file's Phase 2 preamble) and Library (Saved · Archive ·
 * Experience). ADR 0023's "existing routes can stay where they are and
 * simply be reached through the hub, keeping the change UI-shaped rather
 * than a routing rewrite" is implemented literally: this is a plain link
 * row rendered at the top of each of the three Library pages (real
 * navigation between `/saved`, `/overview`, `/experience`) and, on `/skills`,
 * a same-page anchor row (`#skill-map` / `#adoption-log`) linking to the two
 * existing sections already on that one page — no new route was invented for
 * either hub.
 *
 * A plain Server Component (no client state) — `Link` handles both real
 * routes and same-page hash anchors identically.
 */
export function HubSubnav({ items, activeHref }: { items: HubSubnavItem[]; activeHref?: string }) {
  return (
    <nav aria-label="Section" className="mx-auto flex max-w-xl gap-4 px-4 pb-2 pt-3 text-sm">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`border-b-2 pb-1 font-medium transition-colors ${
            activeHref === item.href
              ? "border-accent text-accent"
              : "border-transparent text-ink-faint hover:text-ink-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Library hub members (ADR 0023: "Saved + Experience were never top-level
 *  concerns... Overview → Archive"). `/overview`'s own URL is unchanged —
 *  only its nav placement moves into this hub (ADR 0022, retiring SOTA
 *  itself, stays out of scope for this epic). */
export const LIBRARY_ITEMS: HubSubnavItem[] = [
  { href: "/saved", label: "Saved" },
  { href: "/overview", label: "Archive" },
  { href: "/experience", label: "Experience" },
];
