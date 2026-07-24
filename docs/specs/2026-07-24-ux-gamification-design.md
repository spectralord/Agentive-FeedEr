# UX & Gamification Design — Reel Card, Skill Map, Resurfacing

- Date: 2026-07-24
- Status: proposal, ready for implementation planning
- Author: Design-Expert session (per `docs/specs/design-expert-handoff-prompt.md`, ADR 0014 tier 2)
- Scope: `ReelCard`/`ReelCardBody`, `ReelStackCard`, `ReelActions`, `ResurfaceCard`, `SkillMap`,
  `SkillNodeDetail`, the shared visual system underneath all of them.
- Companion: `docs/adr/0016-ux-design-conventions.md` (binding conventions extracted below)

## 0. How to use this document

This is written against the **actual current code**, not a fresh rebuild — every section names
the real component and describes the concrete diff. Section 8 is not optional reading: it
surfaces two places where the design as first prototyped assumed content the pipeline doesn't
actually produce, and recommends a simpler shape instead. Read section 8 before starting
implementation of section 2.

Process behind this doc: ~15 rounds of interactive HTML prototypes with the product owner,
iterating on structure, content density, and gesture model before any of this was written down.
The prototypes are not preserved anywhere durable (Artifacts, not committed) — this document is
the durable record of what they converged on and why.

---

## 1. Visual system

The existing dark zinc theme is the base — this is refinement, not replacement (the product
owner explicitly chose the evolutionary direction over a rebuild). Add four **reserved** semantic
colors on top; each has exactly one meaning and is never reused for anything else:

| Token | Value | Reserved for | Never used for |
|---|---|---|---|
| `--accent` | `#45b8ab` (teal) | Links, focus rings, "tried" progress ring | Generic decoration |
| `--action` | close to existing `emerald-*` already used for the action box | The sourced Action line, the skill badge, "mark as tried" | Anything not tied to a concrete action |
| `--gold` | `#d1a13c` | "mastered" status only | Anything else — it must stay rare to mean something |
| `--caution` | close to existing `amber-*` already used for the freshness notice | `caveat` (Epic 10, not yet built) and the freshness/supersession notice | Neutral info. (`inkl. gestern`-style non-warning text must never use this token — that was a real bug in an earlier iteration.) |

Neutrals: keep the zinc scale, but define it as explicit tokens (`--ground`, `--surface`,
`--surface-raised`, `--hairline`, `--ink`, `--ink-muted`, `--ink-faint`) in `globals.css` /
Tailwind `@theme` instead of scattered `zinc-800`/`zinc-900` literals — this is what makes the
"never reuse a reserved color for the wrong meaning" rule enforceable later.

**Typography bug, fix regardless of everything else in this doc:** `globals.css` currently sets
`body { font-family: Arial, Helvetica, sans-serif; }`, which silently overrides the Geist font
that's already loaded via `next/font` in `layout.tsx`. The app has been paying for a font it
never renders. One-line fix, zero risk, do it first.

Type scale: sans for reading (title, summary, body text), mono for meta/data (source name +
timestamp, scores, effort tags) with `font-variant-numeric: tabular-nums` wherever numbers sit in
a column.

Motion: transitions in the 250–340ms range, `ease`/`cubic-bezier(.22,.8,.36,1)`, respect
`prefers-reduced-motion: reduce` everywhere. A status ring fills once on the transition into
"tried"/"mastered" — it does not loop, pulse, or replay on every page view. No load-in animation
on the feed itself; scroll-snap already gives it a good rhythm.

---

## 2. Reel Card — read section 8 first

### 2.1 Compact (`ReelCardBody`)

Keep the existing structure, restyle with the tokens above, and fix two things that are currently
real gaps, not style choices:

1. **`reel.skill` is not rendered anywhere today.** SkillTagger (Epic 12) assigns it, nothing
   shows it. Add it to the badge row as `badge--skill` (uses `--action`, the only badge with
   color — everything else stays neutral). This single element does two jobs at once: it's the
   topic tag *and* the "there's a related skill to grow" signal — deliberately not a second,
   separate "look, an action!" element competing for the same sliver of space.
2. **Scores move from the footer to the header, right-aligned to the card's right edge.** Today
   `R {relevanceScore} · Q {qualityScore}` sits in the footer, meaning on a summary long enough to
   need scrolling, you don't see it until you've scrolled there. Move to a compact two-line
   `score-mini` (small label + bar per row) in the top-right of the meta row, visible the instant
   the card is on screen, regardless of scroll position.

Badge row order: category, maturity, `🧪 experimental` (if set), `🆕 New` (if derived), confidence
(if the reel's cluster has one — Epic 11, already implemented, just needs restyling: give it a
subtly different treatment from the plain category/maturity chips, e.g. a small dot-tick instead
of plain text, so "how many independent sources agree" doesn't read as just another category),
skill (new, colored, see above).

The **Action block** (`reel.action` + `effortTag`, today's emerald box) **stays in Compact**,
restyled with `--action` tokens. This is the actual sourced "what does this mean for you" line —
it must not disappear into a tab a user may never open. Effort tag as a small pill next to it, as
today.

The **freshness/supersession notice** (today's amber box, "🕓 Newer available") restyles onto
`--caution`, structurally unchanged (link to the newer cluster + "Confirm superseded" form).

`ReelStackCard`'s banner ("N sources on this topic" / expandable list) restyles onto the same
token system — small source-initial avatars instead of a plain bullet list, consistent with the
Context tab's source list (2.2).

### 2.2 Detail — three tabs

**Revised 2026-07-24, after review:** §8.1 originally recommended dropping the Write-up tab
because no field backs it today. Product decision: keep it, and add the field instead — see ADR
0017 (`reels.writeup`, a second enrichment pass). This section now assumes that field exists;
§8.1 below is kept as a record of the reasoning and the decision, not as a live recommendation.

Entered by tapping the card, or swiping — direction and gesture risk are the product owner's
explicit, informed choice (see 2.3). Push-transition (Detail slides in from the right, Compact
slides slightly out from under it), **not** a swipeable filmstrip — confirmed across two
iterations, this is the one that held up.

- **Write-up tab:** a lightweight single-source reference (source name + trust context) above the
  full `reels.writeup` text (ADR 0017), then `example` if present. This is genuinely longer-form
  than Compact's `summary` — that's the whole point of the new field — so this tab, unlike
  Context/Skill, is expected to need its own scroll on a real phone screen.
- **Context tab:** related/similar sources (Epic 15 cluster members beyond the primary — normally
  empty, most Reels are single-sourced; render the empty state explicitly rather than hiding the
  tab, so "no related coverage" reads as information, not a bug) + `caveat` (once Epic 10 ships).
- **Skill tab:** see section 5.2 — this is genuinely new content, not a restyle of anything that
  exists today.

Write-up is never hidden (once `reels.writeup` is non-null, which should be the common case — see
ADR 0017's generation-scope question). A tab with nothing in it otherwise (Context with no related
sources, no caveat, and — before Epic 10 ships — no caveat field to even check) should not force a
swipe to discover emptiness. Rule: **hide a tab entirely if it would render only its empty
state** — this applies to Context and Skill, not to Write-up.

### 2.3 Gesture model (mobile)

Tap anywhere on Compact's content (except the trust-adjacent elements, which do their own thing)
opens Detail on its first available tab. The skill badge specifically jumps straight to the Skill
tab — a shortcut, not a duplicate path.

**Explicit, product-owner-confirmed trade-off:** swipe-right also opens Detail. This is the same
direction as iOS Safari's edge-swipe-back gesture. Mitigation: ignore touch-starts within ~24px
of either screen edge before treating a horizontal drag as this gesture. This reduces but does
not eliminate the conflict — tap is the reliable primary trigger regardless of swipe behavior,
by design, precisely because of this risk.

---

## 3. Action bar (`ReelActions`)

Functionally complete (save/like/dislike/hide, optimistic UI) — this section is styling only.
Restyle the plain `bg-zinc-800`/`bg-zinc-100` buttons onto the token system: inactive state uses
`--surface-raised`/`--ink-muted`, active state uses `--ink`/`--ground` (unchanged semantics, just
consistent with the rest of the card). No functional changes — this bar's job is small and
already right; don't grow it.

---

## 4. Resurface Card (`ResurfaceCard`, "🔁 Keep at it")

Already exactly the "stay on it" nudge the original brief asked for — currently a bare bordered
box. Restyle onto the token system: each entry gets the same compact meta row treatment as a Reel
(source, category badge) instead of plain text, so it reads as "a Reel you already cared about,"
not a generic list item. Keep the deliberate absence of a "done" checkbox (existing decision,
documented in the component) — items age out of the 7–21 day window on their own, which is the
right call; don't reintroduce a checkbox here.

---

## 5. Skill Map

### 5.1 `/skills` grid + node detail — the marked TODO

Both `SkillMap.tsx` and `SkillNodeDetail.tsx` carry `TODO(UX pass)` comments verbatim asking for
"status rings/colors (gray=seen/blue=tried/gold=mastered), experimental-dot, level-up feel." This
section is that pass.

**Status ring** (SVG circle, `stroke-dasharray`/`stroke-dashoffset`): empty gray outline = `seen`,
partial `--accent` fill = `tried`, full `--gold` fill = `mastered`. Same component, same token
values, used in three places: the `/skills` grid tile, the `/skills/[slug]` detail header, and
the Reel's Skill tab (5.2) — one visual language, not three inventions of the same idea.

**Experimental-dot:** small marker on a grid tile when >50% of its associated Reels are
`experimental` — this was in the *original* epic-7 task description (T7.3) and never got dropped,
just never built. Cheap to compute from the already-fetched associated-content list.

**Level-up feel, deliberately not kitsch:** no confetti, no point counters, no popup. The reward
*is* the ring visibly filling on the one moment it changes, plus the fact that the Skill Map
itself is a persistent, growing personal record — that's the actual gamification, not a
decoration on top of it. A status change gets one quiet ring-fill animation (see §1 motion) and a
plain confirmation, nothing more.

Theme-grouped grid (existing CSS grid, keep — no graph/tree layout, no new dependency, matches
the explicit "Skill *Map*, not Skill *Tree*" decision already in the glossary).

### 5.2 Skill tab inside Reel Detail — new

Not a copy of the node detail page — a low-friction preview reached at the moment someone
encounters relevant content, with a clear door to the full page for anything deeper:

- Status ring (5.1's component) + skill name + theme + status label.
- Node description (existing `skillNodes.description`).
- **One quick action, only when status is `seen`:** "Mark as tried" — a single tap, no note
  field. This *must* call the same `setProgress` mutation the node detail page's form posts to
  (`/skills/[slug]/progress`), not a second implementation of the same state change. Anything
  richer — a note, downgrading, `mastered` confirmation — is intentionally *not* offered here;
  it lives on the real node page, reached via "Open in Skill Map."
- Up to 2 other associated items (Reels/Reports) as a compact preview, "+N more" link to the full
  list on the node page.

---

## 6. Vertical scroll / mobile summary

Native `scroll-snap-type: y mandatory` on the feed — already correct, keep it. Horizontal
Detail-push per Reel is a per-card, not a per-feed, interaction (§2.3). No new dependency for any
of this — CSS scroll-snap + a handful of transforms, same as today's stack.

---

## 7. Prioritized UI task list

| # | Size | Task | Why |
|---|---|---|---|
| 1 | XS | Fix `globals.css` font bug (§1) | Free, immediate, currently paying for an unused font load |
| 2 | S | Extract color/type tokens into `@theme` (§1) | Foundation everything else depends on |
| 3 | S | Move scores to header, right-aligned (§2.1) | Fixes "depends on scroll position" visibility bug |
| 4 | S | Render `reel.skill` badge (§2.1) | Currently invisible despite being computed since Epic 12 |
| 5 | M | Restyle Compact badges/action box/freshness notice onto tokens (§2.1) | Visual system actually applied to the highest-traffic screen |
| 6 | M | Build Detail push-nav + Context tab, with tab-hiding rule (§2.2) | Core of the redesign; do this *after* #2–5 land so tokens exist to build on |
| 7 | M | Skill ring component + apply to `/skills` grid and node detail (§5.1) | Resolves the literal TODO already in the code |
| 8 | M | Skill tab in Reel Detail, wired to shared `setProgress` (§5.2) | New surface, needs the ring component from #7 first |
| 9 | S | Restyle `ReelActions`, `ResurfaceCard` (§3, §4) | Lower-risk polish once the token system exists |
| 10 | L | **Write-up enrichment pass** (ADR 0017 — `reels.writeup` + second pipeline pass) | Blocks the Write-up tab (§2.2) specifically; everything else in this list is independent of it |
| 11 | — | **Remaining product decision** (§8.3/8.4) | Trust-tag's staying power, Skill-tab/node-page duplication guardrail — don't block on these, just don't forget them |

---

## 8. Conceptual critique — not just surface

The product owner asked explicitly for this, after approving the surface direction: challenge the
design conceptually, not just visually. Two of these are real, not manufactured.

### 8.1 The "Write-up" tab was designed against content that doesn't exist — resolved, see ADR 0017

Across the interactive prototypes, Compact and a "Write-up" detail tab were filled with 200–400
word, multi-paragraph long-form text to genuinely test the scroll and tab interactions. That
content was **invented for the prototype**. The actual schema has exactly one prose field per
Reel — `summary` (one paragraph, no length guarantee) — plus optional `example` (a short sourced
quote/snippet) and `action` (one sentence + an effort tag). There is no long-form "detail" field
anywhere in the pipeline.

Consequence: as shipped today, `summary` + `example` + `action` already fit comfortably inside a
single Compact screen — which is exactly what the current `ReelCardBody` does, with no scrolling
and no Detail view needed. A separate "Write-up" tab holding the *same* summary text a second
time adds a navigation step for zero new information, most of the time.

**Original recommendation (superseded):** drop the tab, keep Compact's `summary` as the only prose
field, let the UI tolerate length rather than require it.

**Decision (2026-07-24):** the product owner chose the other fork — keep the Write-up tab, and
build the enrichment pass that backs it. See **ADR 0017** for the new `reels.writeup` field, the
second pipeline pass that produces it, and the open question of which Reels get one. §2.2 above
now reflects this. The underlying principle from ADR 0016 (design for the shortest realistic
content first) still holds as general guidance — it just means "confirm the field exists or is
being built," not "never build for length." Here, the field is being built, deliberately, so the
tab is no longer speculative.

### 8.2 The multi-step checklist (from an earlier prototype round) has no backing data model

An earlier interactive round built a step-by-step, checkable To-Try modal (4 numbered steps,
per-step done state, a notes field) directly on the Reel. That's not buildable as prototyped:
there is no `actionables` table. Progress is tracked in exactly one place —
`user_progress.status` (`seen`/`tried`/`mastered`), one row per **skill node**, not per Reel, not
per step. Epic 6 explicitly *removed* a reel-level "tried" interaction for this reason (see the
comments in `AdoptionLog.tsx`/`SavedList.tsx`) — the project already made this call once.

The glossary still defines **Actionable (To-Try)** as a future concept ("discrete, checkable,
skill-tagged... derived from Reels and Experience Reports") — it's real vision, just not built.
This document does **not** propose building it now (that's a schema change, Product-level,
needs its own grill/ADR — a genuine "how granular, how is it derived, does it duplicate
`user_progress`" set of questions). What this document *does* do: the single "Mark as tried" quick
action in §5.2 is scoped to exactly what `user_progress` already supports, and deliberately
doesn't promise step-by-step tracking the backend can't yet deliver.

### 8.3 Trust-tag: flagged by the product owner as possibly not earning its place — still true

Source-authority (Official/Independent/Community) risks overlapping with two signals that already
exist and are arguably more meaningful: `quality_score` (substance vs. hype — an official source
can absolutely be pure marketing) and `confidence` (independent corroboration, Epic 11, already
real). Keeping all three simultaneously visible risks diluting each rather than reinforcing any of
them. Recommendation: **ship it, but instrument it as a genuine experiment, not a foregone
conclusion** — if it turns out nobody's decision to open a Reel changes based on the trust-tag
after a couple of weeks of real use, cut it in favor of leaning harder on `confidence` (which is
grounded in actual independent-source counting, not just "who published it").

### 8.4 Skill tab duplicating the node page is an acceptable risk, with one hard requirement

§5.2's preview necessarily overlaps with `SkillNodeDetail`. That's fine *only* if both surfaces
write through the same `setProgress` call — two independent implementations of "mark as tried"
would drift (e.g., one remembering to write an adoption-log-worthy note path and one not). Treat
this as a hard constraint on implementation, not a style preference.

---

## Open questions for the strong model / next grill

- §8.1's enrichment-length question: worth a deliberate product decision (lengthen `summary` via
  prompt change, or accept short summaries as the norm and design fully around that)?
- §8.3: worth defining what "earning its place" means operationally (e.g., some usage signal) or
  just a time-boxed gut check?
- Epic 10 (`caveat`) is "buildable" per ADR 0011 but not yet built — §2.2's Context tab is
  designed to degrade gracefully without it (caveat is additive, not required for the tab to make
  sense), so this design doesn't block on Epic 10 landing.
