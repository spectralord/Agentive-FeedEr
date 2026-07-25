# Epic 18 — UX implementation pass (design session 2026-07-24)

> **Status: scoped by the strong model 2026-07-24 on user go-ahead.** Implements every part of
> the UX/gamification design that does **not** depend on unbuilt features. Design source:
> `docs/specs/2026-07-24-ux-gamification-design.md` (§7 is the prioritized list this epic
> follows), ADR 0016 (binding conventions), and the two accepted prototypes in
> `docs/specs/prototypes/`.

**Binding reading order before touching code:**
1. `docs/specs/prototypes/README.md` — what is binding vs. illustrative. **The prototypes are the
   visual source of truth**; where prose and prototype disagree about *looks*, the prototype wins.
2. `docs/adr/0016-ux-design-conventions.md` — reserved colors, one ring component, design for the
   shortest realistic content.
3. The design doc §1–§5 for the section being built.

**Binding constraints (ADR 0016, non-negotiable):**
- Four reserved semantic colors, each exactly one meaning: `--accent` (links/focus/"tried"),
  `--action` (sourced Action line, skill badge, "mark as tried"), `--gold` (**mastered only** —
  it must stay rare), `--caution` (**`caveat` + freshness/supersession only** — never neutral
  info). A new non-alarming status must never reach for `--caution` "because it's already amber".
- **One status-ring component, three call sites** (`/skills` grid tile, `/skills/[slug]` header,
  Reel Detail's Skill tab). No call site re-invents the ring.
- No new dependencies. No new libraries for animation, layout, or gestures.
- `prefers-reduced-motion: reduce` respected everywhere. Transitions 250–340ms.

---

## Scope decisions made by the strong model

### In scope — no dependency on unbuilt features
§7 items #1–#9, plus §9.4 (four honest states — a free read-layer fix, no migration).

### Out of scope — blocked on unbuilt/ungrilled work
| Item | Blocked by |
|---|---|
| §7 #10 Write-up tab + `reels.writeup` enrichment pass | **ADR 0017 is `proposed`** — needs a strong-model grill, a new column and a new pipeline pass |
| §9.2 Guides | **ADR 0018 `proposed`** — schema + new pipeline pass |
| §9.2/§9.3 Actionables (To-Try), evidenced track | **ADR 0019 `proposed`** — schema change, revisits an Epic 6 decision |
| §9.5 Constellation view | **ADR 0020 `proposed`** — schema addition; and §9.9 warns it is "a beautiful shell over thin content" before Guides exist |
| §9.7 Explain-it-back / decay / diffs | Need Guides first |
| §8.3 Trust-tag (Official/Independent/Community) | No source-authority data exists (`sources` has no authority field, and `type` is a fetch mechanism, not authority). Also an open product decision (§7 #11) |

### Two judgment calls — deviations from the design doc, made deliberately

**1. `caveat`: minimal indicator in Compact, full text in the Context tab.** *(Revised
2026-07-24 after the phase-2 design update.)* §2.2 places `caveat` in the Context tab, and §1's
token table still says "(Epic 10, not yet built)" — that part of the design predates Epic 10
Stage 1 shipping (T10.1–T10.4), which already renders the caveat in Compact. Silently demoting a
shipped trust warning into a tab is a visibility regression.

But phase 2 also tightened Compact to "meta row, badge row, title, summary. **Nothing else**",
removing the Action block — so restoring a full caveat *box* would now cut against the design's
own direction. Resolution, using the design's own pattern language for the action ("Compact
carries a **minimal indicator only**"): a small `--caution` marker in Compact signals a caveat
exists; the full text lives in the Context tab. Trust signal stays visible, Compact stays lean.
Note the freshness/supersession notice is explicitly *kept* in Compact by §2.1, so a
caution-class element there is consistent, not an exception.

**2. Detail ships with two tabs (Context, Skill), not three.** Write-up is blocked (above). The
tab system must be built **generically** — an array of tabs plus the §2.2 hiding rule — so
Write-up slots in later with no rework. Consequence to handle explicitly: if *every* tab would be
hidden, the card must not open a Detail view at all (no empty shell, no dead tap target). In
practice most Reels carry a `skill`, so the Skill tab usually populates.

---

## Tasks

### ☑ T18.1 — Foundation: font fix + token system (§1, §7 #1–#2)

- **Font bug, fix first (§1):** `src/app/globals.css` sets `body { font-family: Arial, Helvetica,
  sans-serif; }`, silently overriding the Geist font already loaded via `next/font` in
  `layout.tsx` — the app pays for a font it never renders. The `@theme inline` block already maps
  `--font-sans: var(--font-geist-sans)`; make `body` use it.
- **Tokens (Tailwind v4 — use the existing `@theme` block in `globals.css`, there is no
  `tailwind.config.js` and none should be added):** define the neutrals and the four reserved
  colors as theme tokens so utilities like `bg-surface` / `text-ink-muted` / `border-hairline`
  exist. **Exact values are binding, taken from `docs/specs/prototypes/reel-card-and-detail.html`:**
  ```
  --ground #0a0d10   --surface #12171b   --surface-raised #171d22
  --hairline #232b31 --hairline-strong #2e373e
  --ink #eef1f2      --ink-muted #9aa7ac --ink-faint #5e6a6f
  --accent #45b8ab   --accent-soft rgba(69,184,171,.13)
  --action #3fb673   --action-soft rgba(63,182,115,.14)
  --caution #c98a3a
  --gold   #d1a13c   --gold-soft rgba(209,161,60,.14)
  ```
  Do **not** port the `--trust-*` tokens — the trust tag is out of scope (see table above).
- Mono for meta/data, sans for reading (§1); `font-variant-numeric: tabular-nums` where numbers
  sit in a column. Global `@media (prefers-reduced-motion: reduce)` guard.
- **This task changes no component markup** — it only makes the tokens available and fixes the
  font. Existing pages must render essentially unchanged.
- **Verification:** `npm run build` + `npm test` green; `curl` a page and confirm no visual
  regression beyond the corrected font; confirm the token utilities resolve (use one in a
  throwaway spot, verify, revert).

### ☑ T18.2 — Reel Compact: scores, skill badge, restyle (§2.1, §7 #3–#5)

Depends on T18.1. All of this is `ReelCardBody`/`ReelStackCard` — one task so the file is
touched once.

- **Scores move to the header (§7 #3):** today `R {relevanceScore} · Q {qualityScore}` sits in the
  footer, so on a summary long enough to scroll you cannot see it until you scroll there. Move to
  a compact two-line `score-mini` (small label + bar per row) top-right of the meta row, visible
  the instant the card is on screen. Match the prototype's treatment.
- **Render `reel.skill` (§7 #4):** assigned by SkillTagger since Epic 12 and **displayed nowhere
  today** (verified). Add to the badge row as the skill badge — uses `--action`, and is the
  **only** colored badge; everything else stays neutral. It is both the topic tag and the
  "there's a skill to grow here" signal. Tapping it will later jump to the Skill tab (T18.7) —
  wire the target in T18.7, not here.
- **Badge row order (§2.1):** category, maturity, `🧪 experimental`, `🆕 New`, confidence, skill.
- **Confidence badge** (Epic 11, already implemented) gets a *subtly different* treatment from the
  plain category/maturity chips — e.g. a small dot-tick rather than plain text — so "how many
  independent sources agree" does not read as just another category.
- **⚠️ REMOVE the Action block from Compact.** *(Corrected 2026-07-24 — the design doc was
  revised in phase 2 and this reversed. An earlier draft said it stays; the doc now states that
  was wrong and contradicted both the grill decision and the accepted prototype.)* Today's
  emerald `reel.action` + `effortTag` box **does not survive this redesign**. Compact carries a
  **minimal indicator only** — the skill badge *is* that indicator, doing double duty as topic tag
  and "there's something to apply here". `reel.action` resurfaces in the Detail view's Skill tab
  (T18.7), next to the skill it advances.
- **Compact is therefore exactly:** meta row (time · scores), badge row, title, summary — plus the
  freshness notice and caveat marker below. Nothing else. **Verify against
  `prototypes/reel-card-and-detail.html`, which is correct on this point.** (No trust tag: it is
  in the prototype's meta row but out of scope for this epic — no source-authority data exists.)
- **Freshness/supersession notice** stays in Compact, restyled onto `--caution`, structurally
  unchanged (link + "Confirm superseded" form).
- **`caveat`: minimal `--caution` marker only** in Compact (see judgment call 1 above); the full
  text moves to the Context tab in T18.6. Do not keep the current full caveat paragraph.
- **`ReelStackCard` banner** onto the same tokens, with small source-initial avatars instead of a
  plain bullet list.
- **Verification:** `curl` against `npm run start` with seeded reels covering: caveat set,
  confidence set, supersession set, skill set, and a bare reel. Scores visible without scrolling.
  Build + tests green.

### ☑ T18.3 — Restyle `ReelActions` + `ResurfaceCard` (§3, §4, §7 #9)

Depends on T18.1. **Styling only — no functional change.**
- `ReelActions`: inactive `--surface-raised`/`--ink-muted`, active `--ink`/`--ground`. Semantics
  unchanged. §3 is explicit: "this bar's job is small and already right; don't grow it."
- `ResurfaceCard`: each entry gets the same compact meta row as a Reel (source, category badge)
  instead of plain text. **Keep the deliberate absence of a "done" checkbox** — an existing
  decision documented in the component; items age out of the 7–21 day window on their own.
- **Verification:** curl; build + tests green.

### ☐ T18.4 — Four honest states (§9.4)

Depends on nothing; do alongside T18.5.
- `getSkillMap()` (`src/lib/skills/map.ts:91`, and `:165` for node detail) does
  `progressMap.get(node.id)?.status ?? DEFAULT_PROGRESS_STATUS`, collapsing *"no `user_progress`
  row at all"* into `"seen"`. The DB already distinguishes untouched from explicitly-seen; the
  read layer throws it away.
- Surface **untouched / seen / tried / mastered** — `status: ProgressStatus | null` or an added
  `declared: boolean`. **No migration.** "Untouched" is the truthful state for a node SkillTagger
  created off a Reel nobody ever opened, and it restores meaning to the ring's bottom rung.
- **Verification:** integration test — a node with no `user_progress` row reads as untouched; a
  node explicitly set to `seen` reads as seen; the two are distinguishable.

### ☐ T18.5 — Status ring component + `/skills` grid + node detail (§5.1, §7 #7)

Depends on T18.1 + T18.4. **Resolves the two literal `TODO(UX pass)` markers** in
`SkillMap.tsx:33` and `SkillNodeDetail.tsx:31`.
- **One ring component** (SVG circle, `stroke-dasharray`/`stroke-dashoffset`): untouched =
  barely-visible outline, `seen` = gray outline, `tried` = partial `--accent` fill, `mastered` =
  full `--gold` fill plus the `★` the prototypes show. Built **once**, used on the `/skills` grid
  tile and the `/skills/[slug]` detail header now, and by T18.7 later. ADR 0016 point 2 makes the
  single-component rule binding.
- **Experimental-dot:** small marker on a grid tile when >50% of its associated Reels are
  `experimental`. This was in the original Epic 7 T7.3 description and never got built; cheap to
  compute from the already-fetched associated-content list.
- **Level-up feel, deliberately not kitsch (§5.1):** no confetti, no point counter, no popup. One
  quiet ring-fill animation on the transition itself, plus a plain confirmation. The ring must
  **not** loop, pulse, or replay on every page view — only on the change.
- Keep the theme-grouped CSS grid. No graph/tree layout, no new dependency — the "Skill *Map*,
  not Skill *Tree*" decision is already in the glossary.
- **Verification:** curl `/skills` and `/skills/[slug]` with nodes seeded in all four states;
  ring renders correctly per state; experimental-dot appears only above the threshold; build +
  tests green.

### ☐ T18.6 — Reel Detail: push navigation + Context tab (§2.2, §2.3, §7 #6)

Depends on T18.1–T18.2. Build the **generic** tab system here; T18.7 adds the Skill tab.
- **Push transition** (§2.2): Detail slides in from the right, Compact slides slightly out beneath
  it. Confirmed across two iterations — **not** a swipeable filmstrip. CSS transforms only, no new
  dependency. See the prototype for the exact feel.
- **Tab system:** an array of tabs + the §2.2 hiding rule — **hide a tab entirely if it would
  render only its empty state**. Write-up is not built (ADR 0017); leave the seam so it slots in
  later without rework. **If every tab would be hidden, do not open Detail at all** — no empty
  shell, no dead tap target.
- **Context tab:** cluster members beyond the primary (Epic 15 — normally empty, most Reels are
  single-sourced; **render the empty state explicitly rather than hiding the tab when there is
  other content**, so "no related coverage" reads as information, not a bug) plus `caveat`
  (Epic 10, now built).
- **Gesture model (§2.3):** tap anywhere on Compact's content opens Detail on its first available
  tab. Swipe-right also opens it — a product-owner-confirmed trade-off against iOS Safari's
  edge-swipe-back. **Mitigation is required:** ignore touch-starts within ~24px of either screen
  edge before treating a horizontal drag as this gesture. Tap stays the reliable primary trigger.
- **Verification:** curl; a reel with no cluster siblings, no caveat and no skill opens **no**
  Detail; a reel with a caveat opens Detail on Context; reduced-motion disables the transition.

### ☐ T18.7 — Skill tab in Reel Detail (§5.2, §8.4, §7 #8)

Depends on T18.5 (ring) + T18.6 (tab system). Genuinely new content, not a restyle.
- Status ring (T18.5's component — **not** a second implementation) + skill name + theme + status
  label + the node's existing `description`.
- **One quick action, only when status is `seen`:** "Mark as tried", single tap, no note field.
  **HARD CONSTRAINT (§8.4, ADR 0016):** this must call the **same** `setProgress` mutation the
  node detail page posts to (`/skills/[slug]/progress`) — never a second implementation. Two
  implementations of "mark as tried" will drift.
- **`reel.action` + `effortTag` live here now** (moved out of Compact by the phase-2 revision of
  §2.1 — see T18.2). This is their home: next to the skill they advance, one tap from the card.
  Sourced-only still applies — no `action`, nothing shown, nothing invented. (As a *checkable*
  Actionable it also belongs on the node page, but that is ADR 0019 and out of scope.)
- Deliberately **not** offered here: notes, downgrades, `mastered` confirmation. Those live on the
  real node page, reached via an "Open in Skill Map" link.
- Up to 2 other associated items (Reels/Reports) as a compact preview, with a "+N more" link.
- Tapping the Compact skill badge (T18.2) jumps straight to this tab — a shortcut, not a
  duplicate path.
- **Verification:** curl; "Mark as tried" moves the node to `tried` and the ring updates on both
  this tab and `/skills`; the action is absent when status is not `seen`; build + tests green.

---

---

## Phase 2 — app shell, navigation, missing surfaces (design doc §10, added 2026-07-24)

> A second design audit landed on `main` while T18.1 was in flight, adding design doc **§10** and
> ADRs **0022**/**0023**. §10.10 is its own task list; the tasks below are the ones **not blocked
> on unbuilt features**. Several are *functional breakage, not polish*.
>
> **Excluded from phase 2:**
> - §10.10 #5 (Today completion moment) — needs §9.5's constellation component (ADR 0020, blocked).
> - **Retiring the SOTA section** (ADR 0022) — its own text gates it: "Retire SOTA only once
>   Guides ship" (ADR 0018, blocked). ADR 0022 is also still `proposed`. `/overview` keeps SOTA;
>   only its navigation placement changes (T18.10).
> - The **Knowledge Base** entry in the Skills hub (§9.6) — the surface does not exist.

### ☐ T18.8 — Route boundaries: `loading` / `error` / `not-found` (§10.2, §10.10 #1)

**Functional gap, no design decisions needed.** Verified across all 12 pages: no `loading.tsx`,
no `error.tsx`, no `not-found.tsx` anywhere. Every page is `force-dynamic`, so **every navigation
is a DB round-trip with zero feedback** — on mobile this reads as a dead app. `/clusters/[id]`
and `/skills/[slug]` both already call `notFound()` with nothing designed behind it.
- Route-level `loading.tsx` skeletons **matching each surface's shape** (card outlines for the
  feed, row outlines for lists) — not one generic spinner.
- `error.tsx` with a retry affordance; `not-found.tsx`.
- Use T18.1's tokens. **Verification:** curl each route family; force an error and a 404.

### ☐ T18.9 — Header-height token (§10.9, §10.10 #2)

Header height is currently coupled to layout by magic number (the feed's `-mt-12`/`pt-28` dance).
Replace with a real token. **Prerequisite for T18.10.** **Verification:** header/feed alignment
unchanged; no remaining magic offsets.

### ☐ T18.10 — Bottom tab bar + hubs: 7 links → 4 (§10.1, ADR 0023, §10.10 #3)

Depends on T18.9. **Functional breakage today:** `layout.tsx` renders 7 links plus the brand in
one flex row inside `max-w-xl` — no wrap, no scroll — which **overflows a 375px phone**.
- **Four destinations** (prototype `prototypes/nav-ia.html`): **Today** · **Feed** ·
  **Skills** (hub: Map · Adoption Log — *Knowledge Base omitted, does not exist*) ·
  **Library** (hub: Saved · Archive(`/overview`) · Experience). **⚙ Admin is not a tab.**
- **Bottom bar on mobile**, not top — one-handed phone product.
- **BINDING RULE (the actual content of ADR 0023):** new surfaces go into a hub, **never** onto
  the tab bar. Without this the problem returns every epic.
- **The feed stays a full-screen snap-scroll reel view — not negotiable.** Card height becomes
  `calc(100dvh - var(--tabbar-h))`, with `ReelActions` riding just above the tab bar.
- **Do NOT auto-hide the bar on scroll.** An earlier ADR 0023 draft prescribed it and was
  corrected: with `scroll-snap-stop: always` every swipe is a discrete page turn, so the bar
  would toggle on every card advance (ADR 0023 decision 5).
- **Leave `/` as the Feed.** Making Today the landing route is flagged in §10.1 as "open, worth
  deciding separately" — a product decision, not a design implementation. Note it, don't do it.
- **Verification:** curl at 375px-equivalent; no overflow; snap cards still full-bleed above the
  bar; every previously-reachable route still reachable.

### ☐ T18.11 — Freshness indicator in the app bar (§10.3, §10.10 #4)

`lastPolledAt` / `pipeline_runs.finishedAt` appear **only** under `/admin` — if the pipeline
fails, a user-facing surface shows nothing. **Data already exists**; surface a compact "updated
Xh ago" signal in the app bar. Must **not** use `--caution` for the normal case (ADR 0016 — that
token is caveat/supersession only). **Verification:** curl with a recent and a stale run.

### ☐ T18.12 — Shared empty-state component (§10.7, §10.10 #6)

Empty states are inconsistent and **one is developer-facing** — `src/app/page.tsx`'s empty feed
tells the user to run `npm run job:daily`. Extract one shared component; drop the dev copy.
**Verification:** every empty state renders through it; no CLI instructions in user-facing text.

### ☐ T18.13 — Back-affordance rule for non-tab pages (§10.6, §10.10 #7)

Orphan pages with inconsistent back navigation (`/clusters/[id]`, `/skills/[slug]`,
`/experience/[id]/edit`, …). Define **one** rule for pages that are not tab destinations and
apply it everywhere. **Verification:** every non-tab page has a consistent, working back path.

### ☐ T18.14 — Optimistic mutations for progress/lifecycle (§10.8, §10.10 #9)

Every mutation is currently a full-page POST + redirect. **The pattern already exists** in
`ReelActions` (Epic 6) — extend it to progress (`setProgress`) and lifecycle actions.
- **HARD CONSTRAINT (unchanged from T18.7 / §8.4):** still exactly one `setProgress` mutation
  path. Optimism is a UI layer over it, never a second write path.
- Keep the no-JS fallback where it exists today.
- **Verification:** status change reflects immediately and survives reload; a failed request
  rolls back visibly.

---

## Epic DoD
All tasks checked off with verifications run; `npm run build` + `npm test` green; no new
dependencies; no ADR 0016 violation (especially: `--gold` only for mastered, `--caution` only for
caveat/supersession); the ring exists exactly once; "mark as tried" writes through exactly one
mutation; status table updated.

## Abweichungen/Fragen
_(to be maintained by the executing model)_

- Pre-recorded by the strong model: the two judgment calls above (caveat stays in Compact;
  Detail ships with two tabs and a generic tab system).

**T18.1 (completed 2026-07-25):**
- Token naming: used Tailwind v4's `--color-*` convention directly in the existing `@theme
  inline` block (`src/app/globals.css`) — `--color-ground`, `--color-surface`,
  `--color-surface-raised`, `--color-hairline`, `--color-hairline-strong`, `--color-ink`,
  `--color-ink-muted`, `--color-ink-faint`, `--color-accent`, `--color-accent-soft`,
  `--color-action`, `--color-action-soft`, `--color-caution`, `--color-gold`,
  `--color-gold-soft`. These generate `bg-*`/`text-*`/`border-*` utilities (e.g. `bg-surface`,
  `text-ink-muted`, `border-hairline`, `text-accent`) for later tasks. Values copied verbatim
  from `docs/specs/prototypes/reel-card-and-detail.html`'s `:root` block (confirmed byte-for-byte
  match). `--trust-*` intentionally not ported (out of scope per epic table).
- The new tokens are fixed hex/rgba literals, not `var(--background)`-style indirection —
  unlike `--color-background`/`--color-foreground` they have no `prefers-color-scheme` variant,
  matching the dark-first-only decision in the prototypes README. Existing light/dark
  `--background`/`--foreground` vars and their media-query override were left untouched.
- `font-variant-numeric: tabular-nums` support: **no bespoke utility/token added.** Confirmed
  `tabular-nums` already ships as a Tailwind v4 core utility class (present in
  `node_modules/tailwindcss/dist/lib.js`) — adding a project-defined `.tabular-nums` rule would
  have been redundant and risked a conflicting selector. Later tasks should use the Tailwind
  class directly (typically paired with `font-mono` per §1's mono-for-meta-data rule).
- Added a global `@media (prefers-reduced-motion: reduce)` guard neutralizing
  `transition-duration`, `animation-duration`, `animation-iteration-count`, and
  `scroll-behavior` on `*`/`::before`/`::after` — a superset of the prototype's
  `transition-duration` only version, since later tasks (e.g. T18.5's ring-fill animation) are
  animation-based, not just transition-based.
- Font fix: `body { font-family: var(--font-sans); }` (was hardcoded `Arial, Helvetica,
  sans-serif`, silently shadowing the Geist font loaded via `next/font`). No fallback chain
  appended — `next/font`'s generated `--font-geist-sans` value already includes its own
  fallback stack.
- Verification: `npm run build` + `npm test` green (281/281) both before and after reverting the
  temporary proof. Token-resolution proof: temporarily added `bg-surface` to `<body>` in
  `src/app/layout.tsx`, ran `npm run build` + `npm run start`, confirmed the compiled CSS chunk
  contained `.bg-surface{background-color:#12171b}` (exact token value) and that `curl` against
  `/`, `/today`, `/overview`, `/skills`, `/saved`, `/experience` all returned 200 with the class
  present in the rendered HTML, then reverted `layout.tsx` (git diff after revert shows only
  `globals.css` changed) and re-ran build + tests green.
- No component markup changed (confirmed via `git diff --stat`: only `globals.css` in the final
  diff).

**T18.2 (completed 2026-07-25):**
- **Interpreted "Compact is therefore exactly: meta row, badge row, title, summary — plus the
  freshness notice and a caveat marker below. Nothing else" as naming the *significant*
  restructuring (remove the Action block; add scores + skill badge), not a literal ban on every
  other existing element.** Kept `reel.example` and the "View source" link, restyled onto tokens
  only — neither is called out for removal anywhere (only the Action block gets an explicit
  removal instruction), and design doc §8.1 explicitly values `summary` + `example` fitting inside
  Compact without a Detail view. Their natural destination in the target design — the Write-up
  tab's source-ref + example block (§2.2) — is itself out of scope for the *whole* epic (blocked
  on ADR 0017, `reels.writeup`), so removing them now would delete real, already-shipped content
  from the product with no replacement surface anywhere reachable. Flagged here for review/override
  if the strong model disagrees.
  > **✅ RULING (strong model, 2026-07-25): keep both — correct call, but explicitly TEMPORARY.**
  > Checked against the prototype, which is binding: `compactHtml()` is meta-row → badges → title
  > → summary → tap-hint, with **no** example and **no** source link; `writeupPanel()` carries
  > `source-ref` *and* the `example-block`. So the target design does put both in the Write-up
  > tab — that tab is blocked on ADR 0017. Deleting them now would remove the "sourced mini
  > practice example" (part of the product's own core-value statement) and make the source URL
  > unreachable, which is an ADR 0005 attribution problem. ADR 0016 point 3 warns against building
  > UI for content that doesn't exist; deleting UI for content that *does* exist, in favour of a
  > surface that doesn't, is the same mistake inverted.
  > **Binding follow-up:** when the Write-up tab is built (ADR 0017 lands), `example` and the
  > source reference **move into it** and come **out** of Compact. Whoever builds that must do
  > both halves — this is the one place Compact knowingly deviates from the prototype.
- **Score-mini is bar-only, no literal numbers** — matches the prototype's `scoreMini()` exactly
  (label + bar per row, width = score%). Added `title`/`aria-label` (e.g. "Relevance 82/100") on
  each row for accessibility/hover; this doesn't change the visual, since neither renders as visible
  text.
- **Confidence badge "dot-tick":** implemented as a single leading dot + outline-only pill
  (`border-hairline-strong`, no fill), distinct from the plain chips' filled `bg-surface-raised` +
  `border-hairline`. Read the design doc's "small dot-tick instead of plain text" as one decorative
  dot marking the badge as a different *kind* of chip, not a 3-dot proportional scale (nothing in
  the design doc or prototype specifies the latter, and the prototype file itself predates the
  confidence badge — it's Epic 11, restyled here, not newly designed). Stays neutral ink-muted, not
  one of the four reserved colors.
- **Freshness notice / caveat marker order:** kept freshness notice and caveat marker in the same
  relative order as the pre-existing code (caveat marker before the freshness notice), since neither
  doc specifies an order between the two.
- `EFFORT_LABELS` (in `src/components/labels.ts`) is now unused by `ReelCard.tsx` but left exported
  — needed again by T18.7 when `effortTag` resurfaces in the Skill tab.
- Verification: seeded reels covering the caveat/confidence/supersession/skill/bare-reel sets (via a
  throwaway `tsx` script against the dev DB, not committed), `npm run build` + `npm run start`,
  curled `/`; confirmed score bars render in the meta row (no scrolling needed), the skill badge
  renders with `--action` tokens, the caveat marker shows only "Caveat noted" (not the full text),
  the freshness notice renders on `--caution`, and no "For you:"/Action-block markup exists anywhere
  in the response. Build + tests green (284/284, +3 new `ReelCard` assertions) both before and after
  the dev-DB check (integration tests truncate tables between runs, so the seed data doesn't
  persist — expected, not a bug).

**T18.3 (completed 2026-07-25):**
- Straightforward per spec: `ReelActions` inactive/active classes swapped to
  `surface-raised`/`ink-muted` and `ink`/`ground` 1:1, no logic touched. `ResurfaceCard` entries
  gained a meta row (source name + `CATEGORY_LABELS` badge) above the existing "Saved N days ago —
  take another look?" line and title link; the "done" checkbox stays absent.
- Verification: seeded a 10-day-old `save` interaction on a bare reel, curled `/today`; confirmed
  the action bar's inactive buttons render the new token classes, the resurface entry shows the
  category badge, and the exact "Saved 10 days ago — take another look?" wording is intact (split
  across React text nodes in the raw HTML, as expected for JSX with an interpolated expression).
  Build + tests green (285/285, +1 new `ResurfaceCard` assertion).
