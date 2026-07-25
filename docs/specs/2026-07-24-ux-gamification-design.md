# UX & Gamification Design — Reel Card, Skill Map, Resurfacing

- Date: 2026-07-24
- Status: proposal, ready for implementation planning
- Author: Design-Expert session (per `docs/specs/design-expert-handoff-prompt.md`, ADR 0014 tier 2)
- Scope: `ReelCard`/`ReelCardBody`, `ReelStackCard`, `ReelActions`, `ResurfaceCard`, `SkillMap`,
  `SkillNodeDetail`, the shared visual system underneath all of them.
- Companion ADRs: `0016` (UX conventions), `0017` (Write-up), `0018`–`0020` (Skills)
- **Visual reference: `docs/specs/prototypes/`** — two accepted interactive HTML prototypes;
  see §0 and that folder's README before implementing anything.

## 0. How to use this document

This is written against the **actual current code**, not a fresh rebuild — every section names
the real component and describes the concrete diff. Section 8 is not optional reading: it
surfaces places where the design as first prototyped assumed content the pipeline doesn't
actually produce. Read section 8 before starting implementation of section 2.

> ### ► Open the prototypes first
>
> **`docs/specs/prototypes/`** holds the two accepted, interactive HTML prototypes — open them in
> a browser before writing any code. They are the **visual source of truth**: where prose and
> prototype disagree about how something should *look*, the prototype wins, because it is what was
> reviewed and accepted.
>
> - `reel-card-and-detail.html` — Reel Compact + Detail view (§1–§3, §5.2)
> - `skill-constellation.html` — Skill map + Knowledge Base (§5.1, §9)
>
> **Read `docs/specs/prototypes/README.md` first** — it draws the line between what is binding
> (colour semantics, ring language, transitions, spacing) and what is illustrative (all sample
> content is invented; the constellation's node placement is the *fallback tier only* and is
> superseded by ADR 0020).

Process behind this doc: ~15 rounds of interactive HTML prototypes with the product owner,
iterating on structure, content density, and gesture model before any of this was written down.
The two that survived review are committed under `prototypes/`; the rejected iterations are not,
but the reasoning behind the significant rejections is recorded in §8 and ADRs 0017–0020.

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

> **Prototype:** `docs/specs/prototypes/reel-card-and-detail.html` — three stacked Reels; tap a
> card to push into Detail, tap the skill badge to jump to the Skill tab.

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

## 5. Skill Map — near-term restyle

> **Scope note:** this section is the *near-term* pass on what exists today (the marked
> `TODO(UX pass)`). The larger target vision for Skills — constellation view, Guides, To-Trys,
> Knowledge Base — is **§9**, and is where the product is actually headed. §5 is deliberately
> shippable on its own without any of §9 landing; §9 builds on §5's ring language rather than
> replacing it.

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

## 9. Skill Map & Knowledge Base — target vision

> Companion ADRs: **0018** (Skill Guides), **0019** (Actionables + two-track progress),
> **0020** (constellation layout & placement). All three are *proposed* — they change schema and
> add pipeline passes, which is Product/Architecture territory per ADR 0014, not this session's
> lane. They are written to be grilled, not merged unreviewed.

### 9.1 The gap this closes

The product does "notice" well and "apply" not at all. There is no bridge between *"I saw news
about X"* and *"I claim I know X"* — no verb for **study** anywhere in the app. That gap is the
stated core value ("retain & apply"), and it is currently empty.

Concretely: ADR 0008 promises a durable knowledge layer that accumulates while Reels rotate out.
But inspect what actually accumulates today — the node's existence, a one-line description, and
your own notes. **No knowledge.** When every Reel under "Prompt Caching" ages out, the node is an
empty shell. §9.2's Guide is what makes the durable layer actually carry something durable.

### 9.2 Three things live under a Skill Node

| Layer | What | Lifecycle | User verb |
|---|---|---|---|
| **Feed** | Reels + Experience Reports tagged to the node | Ephemeral (rotates out, ADR 0008) | notice |
| **Guide** | Synthesised knowledge from everything ever tagged here (ADR 0018) | Durable | study |
| **To-Try** | Discrete sourced actionables (ADR 0019) | Durable | apply |

Reels are **inputs** to a node, never progress events. Reading a news item is not competence, so
Reel-seen state must not touch skill progress — confirmed with the product owner. Feed-level
read/unread bookkeeping, if it ever exists, stays in the ephemeral layer alongside
`interactions`.

### 9.3 Two-track progress: declared vs. evidenced

The 2026-07-22 grill already recorded that self-declaration and actionable-evidence "exist
alongside each other." This design honours that literally — two independent tracks per node:

- **Declared** — `user_progress.status` (`seen`/`tried`/`mastered`), honour-based, downgrades
  allowed, **no gates anywhere** (the explicit Skill-*Map*-not-Tree decision).
- **Evidenced** — guide read, N of M To-Trys completed, notes written.

Both are shown together. **"Mastered ring, zero evidence marks" stays fully allowed and fully
visible** — that combination is useful self-knowledge, not something to scold or block. Nothing
in this design gates a status change on evidence.

### 9.4 Four honest states — a free fix available today

`getSkillMap()` currently does `progressMap.get(node.id)?.status ?? DEFAULT_PROGRESS_STATUS`,
collapsing *"no `user_progress` row at all"* into `"seen"`. The database already distinguishes
untouched from explicitly-seen; the read layer discards it before the UI can use it.

So the map can show **untouched / seen / tried / mastered** with **no migration** — just stop
throwing the distinction away (`status: ProgressStatus | null`, or an added `declared: boolean`).
"Untouched" is the truthful state for a node SkillTagger created off a Reel nobody ever opened,
and it restores meaning to the bottom rung of the ring.

### 9.5 Constellation view — the sprawling map

> **Prototype:** `docs/specs/prototypes/skill-constellation.html` — this is the look to hit.
> Its node *placement* is the ADR 0020 fallback tier only, not the target algorithm.

The 8 themes in `src/lib/skills.ts` are **permanent hand-placed regions**; skill nodes are stars
scattered *inside* their own region. The skeleton is designed and fixed, only the leaves are
dynamic — that is what makes an emergent graph read as deliberately laid out.

- **Progress is luminosity, not points.** Untouched nodes are barely-visible outlines; the map
  literally brightens as you learn. Gold appears exactly once in the whole design (mastered),
  which is what keeps gold meaningful. No confetti, no score counter — the reward is that your
  own sky fills in.
- **Size = content volume** (`contentCount`), so a heavily-covered skill reads as bigger.
- **Links = co-occurrence** between skills appearing in the same topic clusters — grounded in
  real data, *not* designed prerequisites, so no gating semantics can sneak in through the back
  door.
- **Placement** is the one genuinely hard part → ADR 0020.

### 9.6 Knowledge Base view — a second face, not a third taxonomy

The KB is **a second view over the same skill nodes**, not a new grouping entity. A third
taxonomy above skill nodes would collide exactly the way a second cluster hierarchy would have —
the argument ADR 0013 already made and rejected.

- **Constellation** answers *"where am I?"* — visual, progress-oriented.
- **Knowledge Base** answers *"what can I learn?"* — textual, grouped by theme, showing per-node
  guide state, open To-Try count, and staleness.

Same nodes, same colour language, different affordances.

### 9.7 Consolidation mechanisms (the "quiz family")

Ranked by what to actually build:

1. **Explain-it-back (recommended primary).** Write 3–4 sentences in your own words; the guide's
   content is used to surface what you left out. Beats multiple-choice on every axis that
   matters: it tests judgment rather than recall, it is cheaper to generate than good
   distractors, and — decisively — **your explanation is a durable artifact**. An `own` Experience
   Report (ADR 0007) is already exactly that shape, so studying feeds back into the content layer
   instead of evaporating.
2. **Knowledge decay.** Nodes dim by time-since-touched, making the map itself the
   spaced-repetition mechanism — no separate review queue, no nagging. **Hard constraint: decay
   dims, never demotes.** A declared status is never lost. "This could use a refresher," never
   "you lost progress" — that distinction is the entire difference between motivating and
   guilt-inducing, and it must not be softened in implementation.
3. **"What changed" diffs.** When a guide re-synthesises after new Reels arrive, show the delta
   since you last read it. Uniquely natural for this product — it sits on a news stream *and* a
   synthesised document — and nearly free once Guides exist.
4. **Confidence calibration.** Rate certainty before revealing; over time you learn where you are
   systematically overconfident. Cheap to bolt onto any of the above.

**Deliberately skipped: classic flashcards.** Proven technique, wrong fit — it turns a
judgment-oriented tool into rote drilling, and evolving practices and trade-offs don't reduce to
atomic facts well.

If quizzes proper are built: **test judgment, never trivia.** *"Your agent rebuilds its tool list
per request — will caching help, and why not?"* is worth generating; *"what percentage discount
does caching give?"* is news trivia that ages out with the Reel. And a manual "I read this"
checkbox is worth being honest about — it adds a click and zero information, the same honour-based
signal as declaring a status. That's fine as bookkeeping; it just isn't evidence.

### 9.8 Mobile

28 nodes at a desktop viewport works; the whole sky at once on a phone does not. Design
**tap-a-constellation-to-zoom** explicitly — the 8 themes are legible at phone size, and tapping
one fills the screen with that theme's stars. This is progressive disclosure that matches the
existing theme grouping, not a shrunken desktop layout. The Knowledge Base view needs no such
treatment; it is already a list.

### 9.9 Sequencing (cheapest-first, each independently valuable)

1. **Four honest states** (§9.4) — no migration, pure read-layer fix.
2. **To-Trys / Actionables** (ADR 0019) — *no new LLM pass at all*: `reels.action` +
   `effortTag` + `skill` are already populated and sourced-only. This is promoting an existing
   column to a checkable object. Smallest step that delivers deliberately-earned progress.
3. **Guides** (ADR 0018) — one new pipeline pass; the step that makes the durable layer real and
   the one everything else leans on.
4. **Constellation view** (ADR 0020) — the visual payoff; needs §9.4 and reads much better once
   Guides exist (a node with no guide is just a dot).
5. **Explain-it-back / decay / diffs** (§9.7) — only meaningful once Guides exist.

**Honest caution:** Guides are load-bearing. The constellation without them is a beautiful shell
over thin content — the prototype deliberately renders "No guide yet" nodes to make that visible.
Don't build 4 before 3 and expect it to feel finished.

---

## Open questions for the strong model / next grill

- §8.1's enrichment-length question: worth a deliberate product decision (lengthen `summary` via
  prompt change, or accept short summaries as the norm and design fully around that)?
- §8.3: worth defining what "earning its place" means operationally (e.g., some usage signal) or
  just a time-boxed gut check?
- Epic 10 (`caveat`) is "buildable" per ADR 0011 but not yet built — §2.2's Context tab is
  designed to degrade gracefully without it (caveat is additive, not required for the tab to make
  sense), so this design doesn't block on Epic 10 landing.

---

## 10. Phase 2 — app shell, navigation, and the surfaces §1–§9 skipped

> Added 2026-07-24 after a second audit pass. §1–§9 designed the Reel card and the Skills layer;
> this section covers everything **around** them — the shell they live in, and the screens that
> were never designed at all. Companion ADRs: **0022** (retire SOTA), **0023** (navigation IA).
>
> Several items here are **functional breakage, not polish** — §10.1 and §10.2 in particular.

### 10.1 Navigation has outgrown its design → ADR 0023

`layout.tsx` renders 7 links plus the brand in one flex row inside `max-w-xl` (576px): Today,
Feed, Overview, Saved, Experience, Skills, Admin. No wrap, no scroll, no responsive treatment —
**this overflows a 375px phone today**, and §9's Knowledge Base makes it 8. They are also
presented as peers when they are four different kinds of thing.

**Four destinations, two of them hubs** (prototype: `prototypes/nav-ia.html`):

| Destination | Contains |
|---|---|
| **Today** | the daily ritual — Top-N, then a real ending (§10.4) |
| **Feed** | browse everything, filters |
| **Skills** | Map · Knowledge Base · Adoption Log |
| **Library** | Saved · Archive · Experience |
| ⚙ (not a tab) | Admin — an ops surface in a single-user app |

**Bottom bar on mobile**, not top: this is a one-handed phone product and the top bar is the
wrong ergonomics. **The binding rule that keeps this from recurring: new surfaces go into a hub,
never onto the tab bar.** That rule is the actual content of ADR 0023 — without it, this problem
returns every epic.

**The real tension, resolved:** a persistent bottom bar eats ~56px of every full-screen snap
card and collides with the floating `ReelActions` bar. **The feed stays a full-screen
snap-scroll reel view — that is not up for negotiation and nothing here changes it.** The card
height simply becomes `calc(100dvh - var(--tabbar-h))` instead of `100dvh`, with `ReelActions`
riding just above the tab bar.

An earlier draft of ADR 0023 prescribed auto-hide-on-scroll here. That was wrong: auto-hide suits
a *continuous* feed, but with `scroll-snap-stop: always` every swipe is a discrete page turn, so
the bar would toggle on every card advance and overlap content sized for the full height. See ADR
0023 decision 5.

**Open, worth deciding separately:** `/` is currently the Feed, but the daily ritual is Today.
Making Today the landing route matches actual use — Today already links onward to the full feed.

### 10.2 No loading, error, or not-found boundaries anywhere

Verified across all 12 pages: no `loading.tsx`, no `error.tsx`, no `not-found.tsx`. Every page is
`force-dynamic`, so **every navigation is a DB round-trip with zero feedback**, and any failure
falls through to Next's default error screen. On mobile this reads as a dead app.

Needed: route-level `loading.tsx` skeletons matching each surface's shape (card outlines for the
feed, row outlines for lists), an `error.tsx` with a retry affordance, and a `not-found.tsx` —
`/clusters/[id]` and `/skills/[slug]` both already call `notFound()` with nothing designed behind
it. No decisions required here; it is straightforwardly missing.

### 10.3 No freshness signal in any user-facing surface

`lastPolledAt`/`pipeline_runs.finishedAt` appear **only** under `/admin`. If the pipeline fails
for three days the feed just looks quiet — indistinguishable from a slow news week. For a
daily-rhythm product that is a trust gap.

Fix: a subtle "updated 3h ago" in the app bar on Today and Feed, escalating to a visible warning
state past a threshold (e.g. >36h). Cheap, and it makes the difference between "nothing happened"
and "something is broken" legible.

### 10.4 Today's completion moment — the one gamification beat that already works

`/today` already ends with "That's it for today ✅" — a genuine completion ritual, currently
plain text. This is the highest-leverage small design in the app.

**Show the constellation lighting up.** A miniature of the §9.5 sky with the nodes touched today
lit, captioned "Your map today", plus a small honest tally (skills touched, to-trys done, days
running). This puts the connection between *"I read news"* and *"my knowledge grew"* directly at
the moment the ritual completes — which is the entire product thesis, currently unexpressed
anywhere in the UI.

No streak-shaming: "6d running" is a rhythm signal, not a counter that punishes a missed day.
Consistent with §9.7's decay rule — nothing is ever taken away.

### 10.5 `/overview` → Archive, and the SOTA section retires → ADR 0022

`isSota()` is `maturity === "established" && relevance >= 70 && quality >= 70` — a per-reel
threshold with **no notion of a topic and no comparison to anything.** State of the art is
inherently comparative and topical; this computes "well-scored established item" and labels it
SOTA. Two symptoms prove the gap: it is age-independent by design (so Epic 11 had to bolt on
freshness/supersession to stop stale items wearing a ⭐), and the UI groups by `category` to fake
a topical dimension the label itself lacks.

Skill Guides (ADR 0018) are topical and comparative by construction. **Retire the SOTA section
once Guides ship — not before**; it is the only thing doing this job today.

The History half is **not** superseded — that is retrieval, which Guides do not do. It becomes
**Archive** inside Library, and it is where the missing **search** belongs (there is currently no
search anywhere in the app, which starts to bite as history accumulates). Keep the existing
filters (period, category, maturity, relevance, has-actionable); `isBestPractice` remains
perfectly honest *as a filter*, it is SOTA-as-a-section that is the problem.

### 10.6 Orphan pages and inconsistent back navigation

`/clusters/[id]` is reachable only from a supersession notice, with no back link and no nav
entry — land there and you are stranded. `/skills/[slug]` has a back link, `/experience/[id]/edit`
does not. Needs one consistent rule: any page not reachable from the tab bar carries a back
affordance to its parent.

### 10.7 Empty states are inconsistent, and one is developer-facing

The feed's no-content state currently reads *"The pipeline runs from Epic 1/2 — collect sources
with `npm run job:daily`"* — epic numbers and a shell command in a user surface. `/today`'s
("enjoy the quiet") and `/saved`'s ("Nothing saved yet — tap 🔖 on a Reel") are both good and
should be the model: say what is true, and where useful say what would change it. One shared
empty-state component, no build instructions.

Related minor hierarchy bug: `/saved` and `/experience` use `text-sm` page titles above 18px card
titles — inverted, and symptomatic of surfaces never having been looked at.

### 10.8 Every mutation is a full-page POST

Progress changes, lifecycle actions, and cluster deprecation all post a form and reload, losing
scroll position. That is a real cost on the skill node page, where marking progress is *the* core
action of the entire Skills vision — the page you are trying to make feel rewarding jumps to the
top every time you use it. Optimistic client updates (the pattern `ReelActions` already
demonstrates) should extend to progress and lifecycle mutations.

### 10.9 Header coupling by magic number

`pt-12` (layout) ↔ `top-12` (FilterBar) ↔ `-mt-12` (feed): three files coordinating header height
through hardcoded 12s. Any nav change — including §10.1's — breaks all three silently. Extract to
a token before touching the shell.

### 10.10 Phase 2 task list

| # | Size | Task | Notes |
|---|---|---|---|
| 1 | S | `loading.tsx` / `error.tsx` / `not-found.tsx` (§10.2) | No decisions needed; do first |
| 2 | S | Header-height token (§10.9) | Prerequisite for #3 |
| 3 | M | Bottom tab bar + hub sub-navs, 7 links → 4 (§10.1, ADR 0023) | Feed keeps full-screen snap; cards size to `100dvh - tabbar` |
| 4 | S | Freshness indicator in the app bar (§10.3) | Data already exists |
| 5 | M | Today completion moment with mini-constellation (§10.4) | Needs §9.5's sky component |
| 6 | S | Shared empty-state component; drop the dev copy (§10.7) | |
| 7 | S | Back-affordance rule for non-tab pages (§10.6) | |
| 8 | M | Archive: search + restyled filters (§10.5) | Retire SOTA only once Guides ship |
| 9 | M | Optimistic mutations for progress/lifecycle (§10.8) | Pattern exists in `ReelActions` |
