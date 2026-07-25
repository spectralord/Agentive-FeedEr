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

**1. `caveat` stays in Compact; Context tab shows it *as well*.** §2.2 places `caveat` in the
Context tab, and §1's token table still says "(Epic 10, not yet built)" — the design was written
**before Epic 10 Stage 1 shipped**. It is now built (T10.1–T10.4) and already renders in Compact.
Demoting a shipped trust warning into a tab the user may never open is a regression, and it
contradicts the doc's own reasoning for keeping the Action block in Compact ("it must not
disappear into a tab a user may never open"). So: keep it in Compact, surface it in Context too.

**2. Detail ships with two tabs (Context, Skill), not three.** Write-up is blocked (above). The
tab system must be built **generically** — an array of tabs plus the §2.2 hiding rule — so
Write-up slots in later with no rework. Consequence to handle explicitly: if *every* tab would be
hidden, the card must not open a Detail view at all (no empty shell, no dead tap target). In
practice most Reels carry a `skill`, so the Skill tab usually populates.

---

## Tasks

### ☐ T18.1 — Foundation: font fix + token system (§1, §7 #1–#2)

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

### ☐ T18.2 — Reel Compact: scores, skill badge, restyle (§2.1, §7 #3–#5)

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
- **Action block stays in Compact**, restyled onto `--action`; effort tag as a small pill beside
  it. It must not move into a tab.
- **Freshness/supersession notice** restyles onto `--caution`, structurally unchanged (link +
  "Confirm superseded" form).
- **`caveat` stays in Compact** on `--caution` (see judgment call 1 above).
- **`ReelStackCard` banner** onto the same tokens, with small source-initial avatars instead of a
  plain bullet list.
- **Verification:** `curl` against `npm run start` with seeded reels covering: caveat set,
  confidence set, supersession set, skill set, and a bare reel. Scores visible without scrolling.
  Build + tests green.

### ☐ T18.3 — Restyle `ReelActions` + `ResurfaceCard` (§3, §4, §7 #9)

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
- Deliberately **not** offered here: notes, downgrades, `mastered` confirmation. Those live on the
  real node page, reached via an "Open in Skill Map" link.
- Up to 2 other associated items (Reels/Reports) as a compact preview, with a "+N more" link.
- Tapping the Compact skill badge (T18.2) jumps straight to this tab — a shortcut, not a
  duplicate path.
- **Verification:** curl; "Mark as tried" moves the node to `tried` and the ring updates on both
  this tab and `/skills`; the action is absent when status is not `seen`; build + tests green.

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
