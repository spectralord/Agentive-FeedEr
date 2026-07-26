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
| ~~§7 #10 Write-up tab~~ → **NOW IN SCOPE** (T18.6, user decision 2026-07-25) | The *tab* and the `reels.writeup` **field** are built now, with an explicit placeholder while the field is null (ADR 0017 amended, ADR 0016 point 3 amended). Only the **enrichment pass that fills it** stays deferred |
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

**2. ~~Detail ships with two tabs~~ → REVERSED 2026-07-25 (user decision): all three tabs ship.**
The original call deferred Write-up because no field backed it. The product owner overrode this:
the tab must exist **now**, with placeholder content, because the entire reason for implementing
the redesign is to feel how the surfaces flow together in a real front end — which a static
prototype cannot show and a missing tab cannot show at all.

Consequences, all folded into T18.6:
- `reels.writeup` (text, nullable) is added now (ADR 0017 decision 1, accepted). The pass that
  fills it is still deferred, so it is `NULL` everywhere for the moment.
- The Write-up tab renders `writeup` when present and an **explicitly-labelled placeholder** when
  null. Placeholder must be obviously a placeholder — never invented realistic prose, never
  silently re-showing `summary` as if it were new (ADR 0016 point 3, as amended).
- Write-up is **never hidden**; the §2.2 hiding rule still governs Context and Skill.
- The "if every tab would be hidden, don't open Detail" edge case is therefore **moot** — every
  Reel always has at least the Write-up tab, so Detail always opens.

**Standing instruction from the user (2026-07-25):** where the design session contradicts an
earlier decision of ours, that is expected — the session deliberately challenged existing
preconceptions. Do **not** block a design change merely because it conflicts with a prior ADR;
change the ADR, recording the amendment and the reasoning. Missing data is not a blocker either:
ship explicit dummy/placeholder content and wire the real source later.

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

### ☑ T18.4 — Four honest states (§9.4)

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

### ☑ T18.5 — Status ring component + `/skills` grid + node detail (§5.1, §7 #7)

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

### ☑ T18.6 — Reel Detail: push navigation + Write-up & Context tabs (§2.2, §2.3, §7 #6)

Depends on T18.1–T18.2. Build the **generic** tab system here; T18.7 adds the Skill tab.

**Write-up tab (added to scope 2026-07-25 — see judgment call 2):**
- Add `reels.writeup` (text, nullable) + migration. **No enrichment pass** — the field stays
  `NULL` for now (ADR 0017 decisions 2–4 still deferred). Add it to `FeedReel`/`getReels`.
- Tab content per §2.2 and the prototype's `writeupPanel()`: a lightweight **source reference**
  (source name) on top, then the write-up prose, then `example` if present.
- **When `writeup` is null → an explicitly-labelled placeholder.** It must read unmistakably as a
  placeholder (e.g. a muted "Long-form write-up not generated yet" note plus clearly-marked
  filler so the tab's scroll/flow can actually be felt). **Never** invent realistic-looking prose
  and **never** silently re-render `summary` as if it were new content (ADR 0016 point 3 as
  amended; ADR 0003's honesty principle applies to the UI too).
- **Write-up is never hidden** — it is always the first tab. The hiding rule governs Context and
  Skill only, so Detail always has at least one tab and always opens.
- **Move `example` and the source reference OUT of `ReelCardBody`** and into this tab — this
  discharges the T18.2 deviation recorded in Abweichungen/Fragen. Compact ends up exactly as the
  prototype's `compactHtml()`: meta row → badge row → title → summary, plus the caveat marker and
  freshness notice.
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

### ☑ T18.7 — Skill tab in Reel Detail (§5.2, §8.4, §7 #8)

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
  > **➜ THIS FOLLOW-UP IS NOW DUE (2026-07-25):** the Write-up tab ships in T18.6, so the
  > deviation ends there — T18.6 must move `example` + the source reference into the Write-up
  > tab and delete them from `ReelCardBody`, leaving Compact exactly as `compactHtml()` has it:
  > meta row → badge row → title → summary (+ caveat marker and freshness notice).
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

**T18.4 (completed 2026-07-25):**
- Modeled the fourth state as an added string literal (`"untouched"`) unioned with the existing
  `ProgressStatus`, not a `declared: boolean` flag: `UNTOUCHED_STATUS = "untouched" as const` +
  `type DisplayStatus = "untouched" | ProgressStatus` in `src/lib/skills/progress.ts`, plus
  `isDisplayStatus()`. Chosen over the boolean because every call site (`SkillMap.tsx`,
  `SkillNodeDetail.tsx`, and later `SkillRing`) already switches on a status *string* — a fourth
  string value slots into that exact shape everywhere, whereas `declared: boolean` would need a
  second field threaded through both interfaces and re-derived at every render site. `ProgressStatus`
  (the three *declarable* statuses) is intentionally left untouched as its own type — form/mutation
  code (`PROGRESS_STATUSES`, `setProgress`, `isProgressStatus`) still only ever writes one of the
  original three; "untouched" is a read-only, DB-absent value, never a write target.
- `getSkillMap()` and `getNodeDetail()` (`src/lib/skills/map.ts`) now default to `UNTOUCHED_STATUS`
  instead of `DEFAULT_PROGRESS_STATUS` ("seen") when `progressMap`/`getProgress` returns nothing.
  `SkillMapNode.status` and `SkillNodeDetail.status` retyped `DisplayStatus`. `DEFAULT_PROGRESS_STATUS`
  itself is kept (still `"seen"`, still exported) since it may still be meaningful as a *write-side*
  default in future code — updated its doc-comment to stop describing a read-layer defaulting role
  it no longer has. No migration; `user_progress` schema/writes are untouched.
- Consumers checked via `grep -rn "DEFAULT_PROGRESS_STATUS\|ProgressStatus"`: only `map.ts`'s two
  read functions defaulted off it for display; the route handler, `SkillNodeDetail.tsx`'s
  `otherStatuses = PROGRESS_STATUSES.filter((s) => s !== status)`, and `AdoptionLog.tsx` all
  continue to compile and behave correctly unchanged (`PROGRESS_STATUSES` — the 3 declarable
  values — was never mixed with the read-side default, so the untouched addition doesn't touch the
  set of statuses a user can pick).
- Verification: added an integration test in `map.integration.test.ts` — a node with no
  `user_progress` row reads `status: "untouched"` from both `getSkillMap()` and `getNodeDetail()`,
  a sibling node with `setProgress(id, "seen")` reads `status: "seen"`, both asserted side by side
  in the same test so the distinction is provably not accidental. Updated the pre-existing
  "defaults status to seen" test (now "defaults status to untouched") and added light component
  tests (`SkillMap.test.tsx`, `SkillNodeDetail.test.tsx`) rendering the `"untouched"` status.
  `npm run build` + `npm test` green (288/288, +3 new tests) after `service postgresql start &&
  npm run db:migrate`.
- This commit deliberately does **not** touch `SkillMap.tsx`/`SkillNodeDetail.tsx` markup, the ring,
  or the experimental-dot — those are T18.5, committed separately per the epic's instruction to
  land T18.4 first in isolation. The route handler (`/skills/[slug]/progress/route.ts`) is
  similarly untouched here; its `previousStatus`-carrying redirect is added in T18.5 alongside the
  ring's fill animation, which is the only consumer that needs it.

**T18.5 (completed 2026-07-25):**
- **Ring component:** `src/components/SkillRing.tsx`, exported as `SkillRing`. API:
  `{ status: DisplayStatus; previousStatus?: DisplayStatus; size?: number; className?: string }`.
  `DisplayStatus` (T18.4's `"untouched" | ProgressStatus`) is the prop type, not a separate
  `RingStatus` — one fewer type for callers to reconcile. `size` defaults to 52 (the prototype's
  header/skill-tab size); the `/skills` grid tile passes `40`. Used at both call sites in scope
  (`SkillMap.tsx` grid tile, `SkillNodeDetail.tsx` header) — the third call site (Reel Detail Skill
  tab) is T18.7, out of this task's scope, but needs no changes to this component's API to slot in.
- **Geometry/dash math:** copied verbatim from `reel-card-and-detail.html`'s `ringSvg()` at the
  default size — r=21, dash=2πr≈131.9, 52×52 viewBox, stroke-width 4, `-rotate-90` wrapper so the
  arc starts at 12 o'clock, tried frac=.55 (dashoffset≈59.4, confirmed via curl below), mastered
  frac=1 (dashoffset≈0) + `★` glyph. `size` scales radius/stroke-width/dash proportionally for the
  grid tile's 40px rings.
- **Fourth-state resolution (untouched vs. seen), and where the two named prototypes disagree:**
  the task pointed at `reel-card-and-detail.html`'s `ringSvg()` for geometry, but that function only
  has three states (seen/tried/mastered), with `seen` = frac 0 (empty gray *track*, no arc).
  `skill-constellation.html`'s `ringSvg()` *does* have all four states, but its `seen` is a frac-.33
  partial arc in `--ink-muted` — which contradicts this task's own prose ("seen = gray outline",
  not a partial fill) and would have meant three different "empty-ish" renderings across the two
  reference files for the same word. Resolution actually used: **untouched and seen are both
  frac-0 (no progress arc at all)**, matching the reel-card model for "nothing declared yet", and
  are told apart by how visible the *track* itself is — `--color-hairline` (barely-visible) for
  untouched vs. `--color-hairline-strong` (a plainly-visible gray ring) for seen. tried/mastered
  match `reel-card-and-detail.html` exactly (frac/color/glyph). This is flagged here explicitly
  since it's a genuine synthesis between the two binding prototype files, not a literal copy of
  either — happy to revise if the strong model reads the intent differently.
- **Experimental-dot:** computed inside `getContentCounts()`'s existing reel-aggregate query in
  `map.ts` (added a `count(*) filter (where experimental)` column to the same grouped `SELECT`) —
  no second query/round-trip. Threshold is strictly `>50%` of a node's **Reels only** (Experience
  Reports have no `experimental` column and are excluded from both numerator and denominator),
  matching the badge's existing semantics (`reel.experimental`, not the separate `maturity` enum —
  confirmed by checking `ReelCard.tsx`'s existing `🧪 experimental` badge, which reads the boolean,
  not `maturity === "experimental"`). Surfaced as `SkillMapNode.experimentalDot: boolean`, rendered
  in `SkillMap.tsx` as a small neutral dot (`bg-ink-faint`, not one of the four reserved colors —
  it isn't one of ADR 0016's four meanings) in the tile's top-right corner. Per the epic prose
  ("a grid tile"), it is grid-only — not added to the node-detail header, which the task doesn't
  ask for.
- **Level-up feel / ring-fill animation — mechanism:** no optimistic-UI infra exists yet (T18.14,
  unbuilt) — every mutation here is still a full-page POST + 303 redirect. To play the fill
  animation *only* on the actual transition (never on an ordinary view/reload), the route handler
  now returns `previousStatus` from `setProgressBySlug` (extended to `ProgressChangeResult { row,
  previousStatus }`, reading the pre-existing row via `getProgress` before the write — the one
  place T18.5 adds a genuinely new query, since knowing "what it was a moment ago" has no cheaper
  source) and appends `?from=<previousStatus>` to the redirect **only when the status actually
  changed**. `/skills/[slug]/page.tsx` validates that query value with `isDisplayStatus()` before
  trusting it and drops it if it equals the current status (stale/replayed URL), passing a
  `previousStatus` prop through to `SkillNodeDetail` → `SkillRing` only when it's a real,
  different-from-current transition. `SkillRing` renders the *old* status directly in its initial
  (server-rendered) markup — confirmed via curl below — then, client-side only
  (`useEffect`/`requestAnimationFrame`), flips its own state to the target status one frame later,
  letting the `transition-[stroke-dashoffset,stroke] duration-300` class animate the fill; T18.1's
  global `prefers-reduced-motion` guard neutralizes that transition for users who've asked for it,
  with no extra code needed here. After ~340ms it strips the `?from=` param via
  `window.history.replaceState` (plain browser API, not `next/navigation`'s `useRouter` — see
  below) so a manual refresh of the same URL never replays the animation. The "plain confirmation"
  is a single `<p>Marked as {status}.</p>` line next to the ring, shown under the same
  `previousStatus !== status` condition — no confetti, no counter, no popup, per §5.1.
- **Why `window.history.replaceState` instead of `next/navigation`'s `useRouter`/`usePathname`:**
  `SkillMap.test.tsx`/`SkillNodeDetail.test.tsx` (and the new `SkillRing.test.tsx`) render these
  components directly via `renderToStaticMarkup`, outside any Next.js app-router context — calling
  `useRouter()` in that setting throws (`invariant expected app router to be mounted`), which would
  have broken every existing unit test touching these components. Vanilla `window.history` needs no
  provider and gives the same result (URL updated without a navigation/re-render). Confirmed safe
  under both the SSR path (`renderToStaticMarkup` never flushes `useEffect`, in Node **or** jsdom —
  it's server-reconciler behavior, not an environment difference) and the real browser path (the
  project's existing `"use client"` components, e.g. `ReelActions.tsx`, already prove this
  "use client" + hooks pattern works fine when imported straight into a Vitest unit test).
- **Retokenized while in these two files:** `SkillMap.tsx`'s tile chrome and `SkillNodeDetail.tsx`'s
  status/back-link/theme-pill/content-list/note-history sections now use the T18.1 token classes
  (`bg-surface`, `border-hairline`, `text-ink`/`text-ink-muted`/`text-ink-faint`, `font-mono` for
  meta/labels per §1) instead of the pre-existing raw `zinc-*` Tailwind classes — not explicitly
  asked for by T18.5's task text, but these are exactly the two files ADR 0016 point 2 names as
  ring call sites, and leaving half the same small component on the old gray palette right next to
  the newly-added ring would have read as inconsistent. Scope still stops at these two files —
  `src/app/skills/page.tsx`'s pending-proposal list (SkillTagger confirm/merge/discard UI) is
  untouched, since neither the TODO comments nor this task mention it.
- **Status label color:** `SkillNodeDetail`'s text status line (`untouched`/`seen`/`tried`/
  `mastered`) uses the exact per-status text colors from `skill-constellation.html`'s
  `.p-status.<status>` rule (`ink-faint`/`ink-muted`/`accent`/`gold`) — a detail neither prose nor
  the ring itself specifies, but directly present in the binding prototype file.
- **Verification:** `service postgresql start && npm run db:migrate`, then `npm run build` +
  `npm test` green (302/302, +14 new tests: `SkillRing.test.tsx` new, plus additions to
  `SkillMap.test.tsx`, `SkillNodeDetail.test.tsx`, `map.integration.test.ts`). Additionally ran
  `npm run start` against a throwaway seed script (6 nodes: untouched/seen/tried/mastered, plus a
  2-of-3-experimental and a 1-of-2-experimental node) and curled the real running app:
  - `/skills`: exactly one `aria-label="Majority experimental"` marker in the rendered DOM (the
    2/3 node), none for the 1/2 node — confirms the `>50%`, not `>=50%`, threshold.
  - `/skills/t18-5-{untouched,seen,tried,mastered}`: raw `<circle>` stroke colors confirmed
    `var(--color-hairline)` only (untouched), `var(--color-hairline-strong)` only (seen),
    `var(--color-hairline)` + `var(--color-accent)` with `stroke-dasharray="131.9"
    stroke-dashoffset="59.4"` (tried, frac exactly .55), `var(--color-hairline)` +
    `var(--color-gold)` + a literal `★` (mastered).
  - POSTed a real status change (`seen` → `tried`) to `/skills/t18-5-seen/progress`: confirmed the
    303 redirect's `Location` header carries `?from=seen`; fetching that URL shows the ring's
    initial server-rendered markup still in the *old* (`seen`) state (`var(--color-hairline-strong)`,
    no accent arc) plus the literal text "Marked as tried." — proving the animation is a
    client-side transition layered on top of correct old-state SSR, not a server-side jump; a
    subsequent plain fetch of the same slug with no query param shows the final `tried` ring and no
    confirmation text. Also checked `?from=tried` (equal to current status) and `?from=garbage`
    (invalid) both correctly suppress the confirmation — the guard in `page.tsx` works.
  - Reset: integration tests truncate their own tables per run (unaffected by this manual seed,
    same as prior tasks' verification notes); no seed data was committed.

**T18.5 ring rungs — corrected by the strong model (2026-07-25):**
The first implementation took the ring's states from `reel-card-and-detail.html`
(`seen` at frac 0, `tried` at .55), leaving `untouched` and `seen` both frac-0 and
distinguishable only by track colour. That defeats the purpose of T18.4/§9.4
("restores meaning to the bottom rung of the ring"). Per
`docs/specs/prototypes/README.md`'s file/section table, the binding prototype for §5.1 is
**`skill-constellation.html`**, whose `ringSvg()` (line ~438) is the only one that knows
about the fourth state and defines a four-rung progression:
`untouched 0 · seen .33 (ink-muted) · tried .66 (accent) · mastered 1 (gold + ★)`.
That is now what `SkillRing` renders. `reel-card-and-detail.html`'s three-rung ring simply
predates the fourth state; where the two prototypes disagree on the Skills surface, the
constellation wins and is also the superset. The constellation ships an explicit
"Untouched — tagged, never opened" legend entry, confirming it is meant to read as its own
visible state.

**T18.6 (completed 2026-07-26):**
- **Schema:** `reels.writeup` (`text`, nullable) added via migration `drizzle/0010_neat_the_stranger.sql`
  (generated with `npm run db:generate`, applied with `npm run db:migrate`). Surfaced on `FeedReel`
  and selected in `getReels` (`src/lib/feed.ts`) — stays `NULL` everywhere, no enrichment pass
  (ADR 0017 decisions 2-4 still deferred).
- **Generic tab system:** `src/components/ReelDetail.tsx` holds a `TAB_DEFS: { id, label }[]` array
  plus an `isTabEmpty(id, data)` switch implementing §2.2's rule — the visible set is
  `TAB_DEFS.filter(t => t.id === "writeup" || !isTabEmpty(t.id, data))`. Write-up short-circuits to
  "never empty" before the switch is consulted, matching judgment call 2. T18.6 ships `TAB_DEFS`
  with exactly `writeup` + `context` (2 entries) — deliberately not adding a `skill` entry yet, per
  the task text ("Build the generic tab system here; T18.7 adds the Skill tab"); the `isTabEmpty`
  switch already has an (unreachable, defensively-typed) `"skill"` case returning `true` so
  `TabId`'s exhaustiveness check doesn't silently pass if T18.7 forgets to update it. This is the
  "seam so it slots in later without rework" the task asks for: T18.7 adds one array entry + one
  switch branch + one panel component, nothing else in the tab machinery changes.
- **Data plumbing, chosen to add zero new queries for Context:** `src/components/reelDetailData.ts`'s
  `buildReelDetailData(reel, clusterMembers)` is a plain (non-component) function, run server-side in
  `ReelCard`/`ReelStackCard`, that turns a `FeedReel` (+ Epic 15 cluster members) into a fully
  primitive-typed `ReelDetailData` (`Date`s pre-formatted via `formatRelativeTime` into strings) —
  this crosses the server/client boundary into `ReelCardShell` (`"use client"`) as an ordinary
  serializable prop, sidestepping any question about whether `Date` objects are safe to pass to a
  Client Component. `ReelStackCard` already receives `others: FeedReel[]` (Epic 15's cluster members
  beyond the primary) as a plain prop with no query of its own — that is *exactly* the Context tab's
  "cluster members beyond the primary" data, so `ReelStackCard` passes `others` straight through
  and **no `getClusterWithMembers` call was added** (the task said it "may help", not that it's
  required — reusing already-fetched data beat a second query). A solo `ReelCard` passes `[]`
  (nothing beyond the primary, by definition of "solo").
- **Push transition:** implemented in `ReelCardShell.tsx` (now the stateful open/tab owner, previously
  only hide-state) — the Compact wrapper and the `ReelDetail` overlay are sibling `absolute inset-0`
  divs inside the same `relative` `<article>`; `ReelDetail` is the later sibling in the DOM so it
  paints on top with no `z-index` needed (matches the prototype's own stacking, which relies on the
  same DOM-order-wins behavior). Both use `transition-transform duration-300 ease-out` (300ms, inside
  the 250-340ms window); Compact moves `translate-x-0 -> -translate-x-[28%]`, Detail moves
  `translate-x-full -> translate-x-0`. The project's existing global
  `@media (prefers-reduced-motion: reduce)` guard (`globals.css`, from T18.1) already neutralizes any
  `transition-duration` on `*`, so no extra reduced-motion handling was needed here.
- **Gesture model:** tap-to-open and the edge-dead-zone swipe are both implemented in
  `ReelCardShell.tsx`, copied faithfully from the prototype's own numbers (`EDGE_DEAD_ZONE = 24`,
  `SWIPE_MIN_DISTANCE = 50`, direction ratio `1.4`). `data-no-open` marks Compact's own interactive
  elements so the tap-handler's `e.target.closest("[data-no-open]")` check lets them keep working
  unmolested: the freshness/supersession block's link + "Confirm superseded" form (`ReelCard.tsx`),
  and — not explicitly named by the task but found while implementing it — `ReelStackCard`'s
  "Show/Hide sources" banner and its member links, which live inside the same clickable Compact
  region and would otherwise have also opened Detail on every click. **Pre-wired ahead of schedule:**
  `ReelCardShell`'s click handler already has an `if (target.closest("[data-open-skill]")) { openDetail("skill"); return; }`
  branch, even though no element carries that attribute until T18.7 adds it to the skill badge — the
  branch is dead code today (unreachable) but avoids touching `ReelCardShell` a second time for what
  is otherwise a one-line addition in T18.7. Flagged for review since the epic's T18.2 note says
  "wire the target in T18.7, not here" — read narrowly as being about the *badge's `data-open-skill`
  attribute and the Skill tab existing at all*, not about this already-generic click-routing
  function having an extra (currently-inert) branch.
- **Write-up placeholder:** an italic, explicitly-labelled note ("Long-form write-up not generated
  yet — the enrichment pass that fills this tab hasn't run yet (ADR 0017)") followed by three
  `opacity-50`, left-bordered, italic filler paragraphs, each literally reading
  "[Placeholder paragraph — no write-up has been generated for this Reel yet. This line repeats only
  to preview how the tab scrolls, and is not derived from the source.]" — repeated rather than
  varied, so it cannot be mistaken for real, generated prose, while still giving the tab enough
  height to scroll on a real phone screen. Verified (test + manual curl, see below) that this never
  duplicates `reel.summary` anywhere in the Write-up tab.
- **`example` + the source reference moved out of `ReelCardBody` into `ReelDetail.tsx`'s
  `WriteupPanel`,** discharging the T18.2-recorded deviation. `ReelCardBody` is now exactly
  `compactHtml()`: meta row -> badge row -> title -> summary, plus the pre-existing caveat marker and
  freshness notice (both correctly kept, matching T18.2's own note that compactHtml() predates
  Epic 10/11's caveat/freshness features). **One interpretation beyond the letter of the task:**
  added a `tap for details →` hint line (`compactHtml()`'s own `.tap-hint`) — not explicitly listed
  in the epic's "Compact is exactly meta/badge/title/summary + caveat + freshness" enumeration, but
  tap-to-open is brand-new behavior as of this task and the prototype itself has this exact
  affordance; flagged for review/removal if the strong model reads the enumeration as exhaustive.
- **Context tab:** cluster members (Epic 15, see above) rendered as a source-avatar list (reusing a
  newly-extracted `src/components/SourceAvatar.tsx`, pulled out of `ReelStackCard.tsx` where it was
  previously a private component, since the Context tab needed the identical treatment — no
  duplicate implementation) plus the full `caveat` text. Per §2.2, the "no related sources" empty
  state renders explicitly (independent of whether a caveat is also present) rather than the whole
  tab being reduced to just the caveat block.
- **"If every tab would be hidden, don't open Detail" is correctly NOT implemented** — Write-up's
  unconditional visibility makes it moot, exactly as the epic's judgment call 2 says; `ReelDetail` is
  unconditionally mounted (off-screen via `translate-x-full` when closed) rather than conditionally
  rendered.
- **Verification:** `service postgresql start && npm run db:migrate`, then `npm run build` + `npm test`
  green (314/314, +11 net new: `ReelCard.test.tsx` restructured into `ReelCardBody` (Compact-only)
  and `ReelCard` (Compact+Detail assembly) describe blocks so Compact-absence and Detail-presence of
  moved content (`example`, full `caveat` text) can both be asserted precisely against the same
  reel — a plain substring check against the full `ReelCard` render can't tell "not in Compact" from
  "in Detail instead" without this split; new `ReelStackCard.test.tsx` covering the Context tab's
  cluster-members list and the stack banner's `data-no-open`). Additionally ran a throwaway seed
  script (not committed) against the dev DB covering exactly the four cases named in the task's own
  verification bullet plus the writeup-present case: a bare reel (no cluster/caveat/skill) → curled
  and confirmed its Detail overlay has **no** Context tab button in the markup, Write-up tab present
  with the placeholder, `tap for details` hint present; a caveat-only reel → confirmed Context tab
  IS present with **both** "Single-sourced." (empty state) and the full caveat text together; a
  cluster (2 members) → confirmed the stack's Context tab lists the other member's source/title and
  the banner carries `data-no-open`; a reel with real `writeup` + `example` → confirmed the Write-up
  tab shows the real paragraphs and the example block, and does **not** show the placeholder text.
  Also confirmed via raw HTML inspection that all four Detail overlays are server-rendered
  off-screen by default (`pointer-events-none translate-x-full` present, no `open`/active state) —
  the push-in only happens client-side once the JS gesture/tap handlers run.

**T18.7 (completed 2026-07-26):**
- **Data access:** `src/lib/skills/reelSkillTab.ts` — `getSkillTabInfoForSlugs(slugs)` batch-fetches
  (one query per table, not per reel) the active skill node + its `getProgressMap` status + every
  Reel/active Experience Report tagged with each distinct slug present on the current feed page,
  mirroring `getInteractionFlags`'s existing batching pattern (`src/lib/interactions.ts`). The
  page-level batch map is built once in `src/app/page.tsx` and `src/app/today/page.tsx` from
  `reels.map(r => r.skill).filter(...)`, then looked up per-card by slug — no per-card query. A
  separate pure helper, `pickSkillTabPreview(info, excludeReelId, max=2)`, excludes the *calling*
  reel's own row (type-scoped: a report sharing the reel's numeric id is not excluded — covered by
  a dedicated test) and caps the remainder at 2, keeping the batch query itself reel-agnostic.
- **A real, non-obvious build break, found and fixed:** `reelDetailData.ts`'s `buildReelDetailData`
  now needs `pickSkillTabPreview` from `reelSkillTab.ts` (DB-touching, via `@/db/client` -> `pg`).
  `ReelStackCard.tsx` is a Client Component (`"use client"`, pre-existing, for its show/hide-sources
  toggle) that previously called `buildReelDetailData` itself — once that function's own import
  graph reached `pg`, `next build` failed trying to resolve `tls`/`util/types` (Node builtins) *in
  the browser bundle*, because Next.js bundles a plain (no "use client") module's entire import
  graph into the client bundle once any Client Component reaches it, even via just one named export.
  **Two-part fix:** (1) `ReelStackCard`'s `detail: ReelDetailData` prop is now built by its caller
  (`page.tsx`, a Server Component) and passed down pre-built, rather than computed inside the client
  component; (2) `ReelCardBody` (previously living inside `ReelCard.tsx`, which itself now imports
  `buildReelDetailData`) was extracted into its own `src/components/ReelCardBody.tsx` with zero
  DB-reaching imports, specifically so `ReelStackCard.tsx` can import *just* the presentational
  Compact body without dragging in `ReelCard.tsx`'s now-heavier import graph. `ReelCard.tsx`
  re-exports `ReelCardBody` for backward compatibility with existing imports (tests, `ReelCard.test.tsx`).
  Caught by `npm run build` (Turbopack's `Module not found: Can't resolve 'tls'` error names the
  exact import chain), not by `npm test` (Vitest's Node environment has no such client/server
  bundling boundary, so the unit tests all passed while the production build was broken) — worth
  recording since it's the kind of break `npm test` alone cannot catch in this codebase.
- **Skill tab UI** (`ReelDetail.tsx`'s new `SkillPanel`): `SkillRing` (T18.5's ONE ring component,
  reused via `size={52}`, not reinvented — ADR 0016 point 2) + title/theme/status-colored label +
  the node's `description`; `reel.action`/`effortTag` (this REEL's own fields, moved here from
  Compact by T18.2) rendered only when present — sourced-only (ADR 0005), nothing invented; up to 2
  "also under this skill" items (using `pickSkillTabPreview`) + a "+N more" link; "Open in Skill Map"
  link to `/skills/[slug]`.
- **"Mark as tried" — the §8.4 hard constraint:** a plain `<form method="post"
  action="/skills/[slug]/progress">` with a hidden `status=tried` input, shown ONLY when
  `status === "seen"` — this is not a re-implementation, it is *the same HTML form pattern already
  used* by the freshness "Confirm superseded" block in `ReelCard.tsx` and (per the node detail page)
  posts to the exact same route (`src/app/skills/[slug]/progress/route.ts`) which calls the exact
  same `setProgressBySlug`/`setProgress` (`src/lib/skills/progress.ts`) the node page's own status
  form posts to. **Deliberately not layered with optimistic UI** — T18.14 (generalizing
  `ReelActions`' existing optimistic pattern to progress mutations) is explicitly out of scope for
  this epic's phase 1; adding a second, ad hoc optimistic layer here now would risk exactly the kind
  of drift §8.4 warns against. A real POST means submitting it navigates away from the feed to
  `/skills/[slug]` (the same destination "Open in Skill Map" already goes to) — noted as a
  deliberate, conservative choice for review: an optimistic-feeling "stay in the feed" version was
  considered and rejected as scope creep into T18.14.
- **Compact skill badge wired to the Skill tab:** `SkillBadge` (`ReelCardBody.tsx`) now carries
  `data-open-skill`, matching the prototype's `data-action="open-skill"`. `ReelCardShell`'s tap
  handler (whose `data-open-skill` branch was pre-wired, inert, in T18.6) now has a live target —
  tapping the badge opens Detail directly on the Skill tab instead of Write-up.
- **Hiding rule:** `ReelDetail.tsx`'s `TAB_DEFS` gained its third entry (`{ id: "skill", label:
  "Skill" }`) and `isTabEmpty("skill", data)` now reads `data.skill === undefined` — `skill` is
  `undefined` both when the reel has no `skill` at all, and (defensively) when `reel.skill` is set
  but no matching *active* node was resolved in the batch map (e.g. a node that existed when tagged
  but is no longer active) — both cases hide the tab per "no skill on the reel -> this tab hides".
  Verified as two separate test cases since they're reached through different code paths.
- **Verification:** `service postgresql start && npm run db:migrate`, then `npm run build` + `npm test`
  green (326/326, +12 net new: 7 `ReelCard.test.tsx` cases covering hide/show, sourced-only
  action/effortTag, the seen-only quick action + its exact form action/hidden-input/status
  transitions, the mastered note, and the 2-item-cap-plus-more-count preview; a new
  `reelSkillTab.integration.test.ts` against real Postgres covering the batch query's
  node/status/newest-first-items resolution, the active-report-only filter, the empty-slug-list
  no-op case, and the pure `pickSkillTabPreview` helper's exclusion/cap logic in isolation).
  Additionally ran a throwaway seed script (not committed) against the dev DB: one skill node with
  two tagged reels (one carrying `action`+`effortTag`, one not), confirmed via `npm run start` +
  curl that (a) with no `user_progress` row the ring/status read `untouched` (bare hairline-strong
  track, no fill) and no quick action shows, matching T18.4's fourth state — not "seen" as an
  earlier, now-superseded draft of this note assumed; (b) after setting the node to `seen` directly,
  both reels' Skill tabs show the `seen` ring, the `action`/`effortTag` block appears only on the
  reel that has them, and the "Mark as tried" form's `action`/hidden-input are exactly
  `/skills/t187-skill/progress` / `status=tried`; (c) **the full mutation round-trip**: `curl -X
  POST -d "status=tried" localhost:3000/skills/t187-skill/progress` returned a 303 with `Location:
  .../skills/t187-skill?from=seen` (proving the real route/handler ran), after which both
  `/skills/t187-skill` (the node page) AND both reels' Skill tabs independently re-rendered the
  `tried` state (`--accent` ring, "tried" status text) and the "Mark as tried" action correctly
  disappeared from both — direct proof the Skill tab writes through the exact same path the node
  page does, not a second implementation.
