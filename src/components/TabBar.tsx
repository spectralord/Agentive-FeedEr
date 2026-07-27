"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * T18.10 (§10.1, ADR 0023): the four primary destinations. Two are hubs —
 * Skills and Library each hold more than one screen behind a segmented
 * sub-nav (`HubSubnav.tsx`), reached by first landing on the hub's tab-bar
 * entry, then switching sections in-page. ⚙ Admin is deliberately NOT in
 * this array — it is an ops surface reached from the app-bar gear instead
 * (see `AdminGearLink` below), per ADR 0023 decision 2.
 *
 * BINDING RULE (ADR 0023 decision 4 — the actual durable content of that
 * ADR): a NEW surface goes into one of the two hubs below, never as a fifth
 * entry in this array. Without that rule the 7-links-in-one-row overflow
 * this task just fixed comes back the next time an epic adds a screen.
 */
const TABS = [
  { id: "today", href: "/today", label: "Today", icon: "◎" },
  { id: "feed", href: "/", label: "Feed", icon: "▤" },
  { id: "skills", href: "/skills", label: "Skills", icon: "✦" },
  { id: "library", href: "/saved", label: "Library", icon: "▣" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TITLES: Record<TabId, string> = {
  today: "Today",
  feed: "Feed",
  skills: "Skills",
  library: "Library",
};

/**
 * Maps the current pathname to a tab id, or `null` for a page that isn't a
 * tab-bar destination (Admin, and the "deep" pages ADR 0023's Consequences
 * section names — `/clusters/[id]`, `/skills/[slug]`, `/experience/[id]/edit`
 * — which are reached *from* a tab, not directly off the bar; see T18.13's
 * back-affordance rule for how you get back). Exported as a plain function,
 * not read via `usePathname()` internally, so it can be unit-tested without
 * an app-router context (the same concern T18.5's notes raised about
 * `useRouter` throwing outside one — see `SkillRing.tsx`'s history).
 */
export function activeTabId(pathname: string): TabId | null {
  if (pathname === "/") return "feed";
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/skills")) return "skills";
  if (
    pathname.startsWith("/saved") ||
    pathname.startsWith("/overview") ||
    pathname.startsWith("/experience")
  ) {
    return "library";
  }
  return null;
}

/** Contextual app-bar title (prototype: `nav-ia.html`'s `#appTitle`) — falls
 *  back to the brand name on pages that aren't one of the four destinations
 *  (Admin, `/clusters/[id]`, `/skills/[slug]`, `/experience/[id]/edit`, …). */
export function AppBarTitle() {
  const pathname = usePathname();
  const active = activeTabId(pathname);
  return (
    <span className="text-sm font-semibold tracking-tight text-ink">
      {active ? TITLES[active] : "Agentive-FeedEr"}
    </span>
  );
}

/** ⚙ Admin — off the tab bar entirely (ADR 0023 decision 2), reached via a
 *  small gear icon in the app bar instead, matching `nav-ia.html`'s `.gear`
 *  button exactly. */
export function AdminGearLink() {
  return (
    <Link
      href="/admin"
      aria-label="Admin"
      title="Admin"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-raised text-xs text-ink-faint transition-colors hover:text-ink"
    >
      ⚙
    </Link>
  );
}

/** T18.10 (§10.1, ADR 0023): persistent bottom tab bar. Deliberately NEVER
 *  hides on scroll — an earlier ADR 0023 draft prescribed auto-hide, and was
 *  corrected (decision 5): with `scroll-snap-stop: always` every swipe on
 *  the feed is a discrete page turn, so the bar would toggle on every card
 *  advance. Cards are instead sized to `calc(100dvh - var(--tabbar-h))` so
 *  the bar simply always has its own space. */
export function TabBar() {
  const pathname = usePathname();
  const active = activeTabId(pathname);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex h-[var(--tabbar-h)] justify-center border-t border-hairline bg-ground/95 backdrop-blur"
    >
      <div className="flex w-full max-w-xl">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 text-[10px] tracking-wide ${
              active === tab.id ? "text-accent" : "text-ink-faint"
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
