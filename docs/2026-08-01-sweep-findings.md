# Full-project sweep — 2026-08-01

> Carried out per `HANDOFF.md` §4. Rung 1 (screenshots) throughout for UI findings.
> Baseline: `main` @ `307371e`, clean, in sync with `origin/main`.
> Build clean · typecheck clean · **377 tests / 60 files green** · 1 known eslint error.
> Every subagent finding was independently re-verified before being recorded here.

---

## Verdict

The code is in **good shape**. Zero BLOCKERs; the two BLOCKERs from the last session are
genuinely fixed and were re-verified by real interaction, not DOM inspection. The
architecture holds: the ADR 0015 executor seam is respected by all six LLM steps, ADR 0003
(null over hallucination) is respected where content is missing, and the design system is
correct *inside* the components Epic 18 touched.

**The problems are at the edges and in the paperwork**, in three clusters:

1. **A colour-semantics leak** that makes neutral information look like a warning.
2. **An un-tokenised legacy perimeter** (222 literals) that reads as two visual systems.
3. **Process drift** — the status table is stale a third time, and a fully-shipped ADR is
   still marked `proposed`.

---

## 1. Conformance findings (built, and wrong)

| Sev | Finding | Where | Source violated |
|---|---|---|---|
| MAJOR | Neutral text "incl. yesterday" in the reserved caution colour. **Visually the most alarming element on `/today`** — reads as a warning; it is a scope note. | `src/app/today/page.tsx:48` | ADR 0016 pt 1 (names this exact bug) |
| MAJOR | Amber for neutral filter toggles: "Weak signal" and "🧪 experimental" | `FilterBar.tsx:105`, `OverviewFilterBar.tsx:157` | ADR 0016 pt 1 |
| MAJOR | **222** raw `zinc-*`/`amber-*`/`emerald-*` literals in 20 non-test files. Visible seam: `/overview` + `/saved` still show footer `R 88 · Q 90` text where the restyled card uses score bars. | worst: `admin/page.tsx` 37, `skills/page.tsx` 24, `clusters/[id]/page.tsx` 22, `ExperienceFilterBar` 17, `ExperienceReportItem` 16 | ADR 0016 / spec §1 |
| MAJOR | **Zero `focus-visible` states app-wide.** Only 7 plain `focus:` rings exist, all on form inputs, all `zinc`/`hairline`. Feed, tab bar, Detail tabs and every filter chip are keyboard-unnavigable. | whole codebase | spec "Accessibility" |
| MAJOR | `/skills` inverts its own hierarchy: `New Skills` (`h1`, `text-lg`, 3-line explainer) owns the top third and its content is merely "No open proposals." — pushing **Skill Map** (`h2`, `text-sm`, the product thesis) below the fold. | `skills/page.tsx:35` vs `:106` | spec §10.7 (same bug class it flagged for `/saved`) |
| MAJOR | Skill Map node titles truncate to ~14 chars at 2-up on 375px: "Agentic Tool…", "Computer U…", "Prompt Cac…". A skill map whose labels are unreadable undercuts its purpose. | `SkillMap.tsx:42` | spec §5/§9 intent |
| MINOR | "Weak signal" chip is effectively undiscoverable: sits at **x=821 in a 977px strip clipped to 375px** (`scrollLeft:0`, `inViewport:false`) — 602px of horizontal scroll with no scrollbar or fade affordance. | `FilterBar.tsx:101-110` | spec §10.1 |
| MINOR | ReelActions buttons measure exactly **38×26px** (all 44 instances). Height is the real miss — 26px is under two-thirds of the ~40px floor on the card's primary actions. | `ReelActions.tsx:31-34` | spec "Touch targets" |
| MINOR | ADR number in shipped **user-facing copy**: "…hasn't run yet (ADR 0017)". | `ReelDetail.tsx:84-86` | spec §10 "no epic numbers in user copy" |
| MINOR | Bright ⭐/🕐 emoji compete with reserved `--gold` on `/overview`; the yellow ⭐ is the most saturated thing on the page and means "well-scored", not "mastered". | `SotaSection.tsx` | ADR 0016 pt 1 (gold must stay rare) |
| MINOR | `ResurfaceCard` uses `min-h-dvh` where every sibling reel container uses `min-h-[calc(100dvh-var(--tabbar-h))]` → runs under the fixed tab bar. **Not visually verified** (needs a save 7–21 days old; the only seeded save is 45 min old) — source only. | `ResurfaceCard.tsx:25` | consistency w/ `ReelCardShell.tsx:93` |
| MINOR | `src/app/page.tsx` — the Feed, the default landing route — is the only primary surface without `export const dynamic = "force-dynamic"`; 8 other pages have it. Dynamic in practice via `Promise` searchParams, but inconsistent. | `src/app/page.tsx` | consistency |
| — | Pre-existing eslint error, `react-hooks/purity`: `Date.now()` during render. Exactly 1 problem repo-wide. | `overview/page.tsx:43` | — |

### Seam leak (INFO, worth a decision)

`src/lib/enrichment/run.ts:81` uses `error instanceof Anthropic.APIError` — an API-specific
error class inside an executor-agnostic step. In the `claude-code` executor path that branch
can never be true, so **transient-error handling silently differs by executor**. Not a
violation of ADR 0015's "no direct API access for inference" rule (the import is only used
for error classification), but it is the seam leaking.

---

## 2. Documentation findings (the docs are wrong, not the code)

This was the highest-value category again, as the handoff predicted.

1. **The status table is stale a third time.** `docs/plan/README.md:125,130` mark
   **Epic 7 (Skill-Map)** and **Epic 12 (SkillTagger)** as `☐ offen` — both are **fully
   built and tested**: `src/lib/skilltagger/{tagger,run,nodes,prompt,schema}.ts` with tests,
   `src/app/skills/{page,loading,[slug]}/`, `src/lib/skills/{map,progress,progressStatus,reelSkillTab}.ts`.
   The table calls itself the single source of truth.

2. **`APP_PROFILE` default doc is wrong, and it is the money-relevant one.**
   `docs/plan/README.md:94` says the default is `cloud`; `src/lib/env.ts:41` is
   `.default("local")` since 2026-08-01. `cloud` implies `executor=api` — the paid API. The
   flip was made deliberately and pinned by a test, but the env-var reference was not updated
   with it.

3. **`HANDOFF.md` contradicts itself and reality.** §3 says "none of it is pushed"; §1 says
   "Everything is pushed" at `4a6d265`. Actual: `main` is clean and in sync with
   `origin/main` at `307371e` — everything *is* pushed, and both stated SHAs are behind.

4. **Test counts disagree three ways.** Actual **377**; `HANDOFF.md` §3 says 375; the Epic 18
   status entry says 364.

5. **ADR 0016 never states the app is dark-only.** Zero mentions of dark mode or
   `prefers-color-scheme` in the whole ADR. This is *why* T18.1 left the Epic-0
   `prefers-color-scheme` pair alone and shipped the white-background BLOCKER. Confirms
   handoff §6.3.

### Verified-good (claims that held up)

- Node/env docs are correct and consistent (`LOCAL_SETUP.md` properly says 20.19+/22.12+,
  not "22+").
- `npm test` **does not** wipe the dev DB — verified empirically: **16 reels before and after**
  a full 377-test run. `TEST_DATABASE_URL` present, `feedr_test` exists.
- The three parked epics (8, 14, 16) each carry an explicit "do not build without user go"
  header with open design questions listed. Correctly parked — **no dead scope found.**

---

## 3. Governance finding

**ADR 0023 (navigation IA) is still `Status: proposed` but is fully implemented.** T18.10
shipped the 7→4 tab bar and the Skills/Library hubs against it; `TabBar.tsx:20-23` has exactly
the four destinations it specifies. Shipping against an unratified ADR inverts the intended
order and is the same root cause as handoff §6.1 (the Detail-vs-chrome BLOCKER came from a
decision nothing had ratified). Lesser degree, same shape: ADR 0017 is "partially accepted"
with decision 1 built.

---

## 4. Refutations — claims checked and found *correct by design*

Recorded so they are not re-raised:

- **`reels.writeup` is NULL for all 16 reels** (verified in schema *and* live DB). The
  Write-up tab's labelled placeholder is honest, deliberate ADR 0003 behaviour. **Not a defect.**
- **`--accent` is not unused.** The handoff says it is "never used"; it is used in 12 real
  (non-test) places — TabBar active, SourceAvatar, HubSubnav, ReelDetail "tried", relevance
  bar, SkillRing "tried". The accurate finding is narrower: it is never used *as a focus ring*,
  because no focus ring uses it.
- **`--gold` is correctly scoped** — every usage ties to `mastered`.
- **The skill badge's green is `--action`** (`#3fb673`), not a raw `emerald` literal. Conformant.
- **One `SkillRing` at exactly three call sites**; single `setProgress` write path; **no gates**
  (`progress.ts`: "downgrades allowed — this is a map, not a gated tree"); `untouched ≠ seen`
  preserved.
- **Body-level horizontal overflow: 0px** on every route at both viewports.
- **SOTA section correctly still present** — ADR 0022 retires it only once Guides ship, and no
  `skill_guides` table exists.
- Font, dark-first background, `prefers-reduced-motion`, 4 tab destinations, snap-scroll,
  route boundaries: all correct.

### Note for future reviewers

The dark circular **"N" badge overlapping the Today tab label** in dev screenshots is the
**Next.js devtools indicator**, not a product defect. Do not report it.

---

## 5. Not built yet (not defects)

- Write-up enrichment pass (ADR 0017 decisions 2–4) — `writeup` NULL by design.
- Guides (0018), Actionables (0019), Constellation (0020), SOTA retirement (0022).
- §10.4 Today completion moment; §10.1 landing-route question (`/` is still Feed).
- Epic 11 T11.7a–e, Epic 10 T10.8 — both grilled and ready to delegate.
