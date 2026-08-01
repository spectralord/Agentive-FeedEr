# ADR 0023 — Navigation IA: four destinations, hubs, and the rule that keeps it that way

- Status: **accepted** 2026-08-01 (user decision). Implemented by Epic 18 **T18.10**, which shipped
  the 7→4 tab bar and the Skills/Library hubs — i.e. **the code landed before this ADR was
  ratified**, which is recorded here rather than tidied away: it is the same governance gap that
  produced the Detail-vs-chrome BLOCKER (decision 6 below now closes that one). All five original
  decisions were verified against the implementation at ratification time: four destinations
  (`TabBar.tsx`), Admin as an app-bar gear, bottom tab bar, the hub rule, and the persistent
  (never auto-hiding) tab bar with cards sized to `calc(100dvh - var(--tabbar-h))`.
  Was: proposed (design-expert session, ADR 0014 tier 2).
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

6. **Reel Detail covers the app bar, but never the tab bar.** Detail is `fixed` at `top-0` with
   `bottom: var(--tabbar-h)` and `z-30` — it paints over the app bar and the FilterBar (both
   `z-20`), and stops exactly at the top edge of the tab bar, which stays visible and interactive.

   Measured on a 375×812 viewport with Detail open: overlay spans y=0…756, tab bar occupies the
   remaining 56px and is hit-testable.

   **Rationale.** Detail should own the screen for *reading* — the app bar's contextual title and
   freshness indicator are feed-level chrome with nothing to say about the item you opened, so
   covering them buys reading space at no cost. The tab bar is different: decision 5 already
   makes it persistent *everywhere*, and honouring that here means you can leave a Reel by tapping
   Skills or Library directly instead of going Back first. Detail carries its own Back affordance
   as well, so there are two exits rather than one.

   > **Added 2026-08-01 (user decision), closing a real gap.** Nothing in this ADR, §10.1, §10.9
   > or the design doc previously said which of Detail and the shell chrome was on top. That
   > omission shipped a **BLOCKER**: Detail was `absolute` inside a `relative` `<article>`, so it
   > painted *beneath* the app bar and FilterBar and every control — Back and all three tabs — was
   > covered. A Playwright `click()` on Back timed out. The fix (`fixed … z-30`) was correct but
   > unratified; this decision ratifies it and states the boundary explicitly so the next
   > implementer does not have to infer it.
   >
   > Rejected alternatives: **full-frame** (also covering the tab bar) matches the prototype, where
   > Detail fills the whole phone screen — but the prototype has no app bar outside `.reel-slot`,
   > so it cannot speak to this question, and full-frame contradicts decision 5. **Docked beneath
   > the app bar** keeps feed chrome visible that is irrelevant to the open item, and costs 48px
   > of reading space on the primary 375px target.

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

- ~~**Should `/` become Today rather than Feed?**~~ **DECIDED 2026-08-01 (user): `/` stays the
  Feed.** Today is one tap away on the tab bar, and Feed is the better default for browsing. The
  argument *for* Today — that it matches actual use — depends on Today being a destination with a
  payoff, and design doc **§10.4's completion moment is unbuilt**: Today currently just ends. Worth
  revisiting once §10.4 ships; until then this is settled, not open.
- **Desktop treatment.** Bottom bars are a mobile convention. On a wide viewport a persistent side
  rail or a top bar may serve better — the four-destination structure holds either way, but the
  rendering is unresolved and should not be assumed to be "the mobile bar, wider".
