# ADR 0023 — Navigation IA: four destinations, hubs, and the rule that keeps it that way

- Status: proposed (design-expert session, ADR 0014 tier 2)
- Date: 2026-07-24
- Related: ADR 0022 (`/overview` → Archive, which this ADR relocates), design doc §10.1
- Prototype: `docs/specs/prototypes/nav-ia.html`

## Context / Problem

`src/app/layout.tsx` renders seven links plus the brand name in a single flex row inside a
`max-w-xl` (576px) container: Today, Feed, Overview, Saved, Experience, Skills, Admin. There is no
wrap, no horizontal scroll, and no responsive treatment. **On a 375px phone — the product's
primary target — this overflows today**, and the Knowledge Base view from design doc §9.6 would
make it eight.

The deeper problem is that the nav was never *designed*; it accreted. Each epic appended a link.
The seven entries are presented as peers but are four different kinds of thing:

- **consume** — Today, Feed
- **retrieve** — Saved, Overview
- **grow** — Skills (+ Knowledge Base)
- **operate** — Admin

A flat list hides that structure and guarantees the overflow returns with the next epic. Fixing
the overflow alone (scroll the row, shrink the text) treats the symptom.

## Decision (proposed)

1. **Four destinations, two of which are hubs:**

   | Destination | Contains |
   |---|---|
   | **Today** | the daily ritual — Top-N, then a completion moment (design doc §10.4) |
   | **Feed** | browse everything, filters |
   | **Skills** | Map · Knowledge Base · Adoption Log |
   | **Library** | Saved · Archive · Experience |

   Hubs use a segmented sub-nav; both happen to hold three sub-views, which keeps the pattern
   consistent and learnable.

2. **Admin leaves the primary navigation.** It is an operator surface in a single-user app —
   a gear in the app bar, not a peer of the daily reading ritual.

3. **Bottom tab bar on mobile.** This is a one-handed phone product; a top bar puts primary
   navigation at the least reachable edge. Desktop/iPad may render the same four destinations
   however suits the width.

4. **The binding rule — new surfaces go into a hub, never onto the tab bar.** This is the actual
   durable content of this ADR. Without it, the next epic adds an eighth link and the problem
   returns; with it, growth lands inside Skills or Library where a segmented control absorbs it.
   The tab bar is a fixed four.

5. **The tab bar is persistent everywhere, including the feed; snap cards are sized to the
   remaining viewport** — `height: calc(100dvh - var(--tabbar-h))` rather than `100dvh`. The
   floating `ReelActions` bar sits just above the tab bar.

   **This corrects an earlier draft of this ADR, which prescribed auto-hide-on-scroll.** That is
   the right pattern for a *continuous* feed (Instagram home, Twitter) and the wrong one for a
   *snap-paged* feed: with `scroll-snap-stop: always`, every swipe is a discrete page turn that
   fires a scroll event, so the bar would toggle on every single card advance, and each
   re-appearance would overlap content laid out for the full height. Sizing the cards to the
   real visible area instead costs ~56px of card height, keeps navigation permanently reachable,
   and makes snap points align exactly. Do not reintroduce auto-hide here.

## Alternatives

- **Keep the top bar, make it horizontally scrollable:** smallest change, fixes the overflow,
  fixes nothing else — the flat structure and the growth problem both survive, and primary nav
  stays at the unreachable edge on a phone. Rejected.
- **Hamburger/drawer menu:** absorbs unlimited entries, which is precisely the trap — it removes
  the pressure that keeps an IA honest, and hides everything behind an extra tap. Rejected.
- **Three tabs (fold Feed into Today):** tempting, since Today already links onward to the feed.
  Rejected — Feed is a primary browsing surface and deserves to be one tap away; four is still
  well within the comfortable range for a bottom bar.
- **Five or six tabs (promote Saved, keep Admin):** exceeds what a phone tab bar comfortably
  holds, and re-flattens exactly the structure this ADR is introducing. Rejected.

## Consequences

- `layout.tsx` is restructured: app bar (contextual title, freshness indicator, gear) plus a
  bottom tab bar. The header-height magic numbers coupling `layout.tsx`, `FilterBar.tsx` and the
  feed (`pt-12` / `top-12` / `-mt-12`, design doc §10.9) **must** be extracted to a token first —
  this change breaks all three otherwise.
- Two hub pages are new (`/skills` gains a sub-nav; Library is a new route grouping
  `/saved`, `/archive`, `/experience`). Existing routes can stay where they are and simply be
  reached through the hub, keeping the change UI-shaped rather than a routing rewrite.
- `/overview` → `/archive` per ADR 0022, landing inside Library.
- `/admin` stays routable and simply loses its nav entry.
- Deep pages not reachable from the tab bar (`/clusters/[id]`, `/skills/[slug]`,
  `/experience/[id]/edit`) need a consistent back affordance — currently only some have one
  (design doc §10.6).

## Open questions

- **Should `/` become Today rather than Feed?** The daily ritual is Today; the root route is
  currently the Feed. Making Today the landing page matches how the product is actually used, but
  it changes the meaning of an existing URL and is worth deciding deliberately rather than folding
  into this ADR.
- **Desktop treatment.** Bottom bars are a mobile convention. On a wide viewport a persistent side
  rail or a top bar may serve better — the four-destination structure holds either way, but the
  rendering is unresolved and should not be assumed to be "the mobile bar, wider".
