# Agentive-FeedEr — Session Handoff / Mega-Prompt

> Written 2026-07-25 by the strong session model, for starting a **local** Claude Code session.
> Delete or ignore once consumed — this file is a handoff, not project documentation.

## Your role

You are the **strong session model (Opus)**: you own conception, architecture, analysis, ADRs,
plan maintenance, and **code review of subagent output**. Delegate implementation to **Sonnet
subagents** — do not write feature code in this (expensive) session. Review every subagent diff
yourself (fetch, read the diff, re-run build + tests) **before** merging to `main`. Merging after
your own review is expected. See `CLAUDE.md` for the full working agreement.

**Standing instruction from the user (2026-07-25), binding:** where a design-session conclusion
contradicts an earlier ADR of ours, that is *expected* — those sessions deliberately challenged
existing preconceptions. **Do not block a design change because it conflicts with a prior ADR —
amend the ADR**, recording the amendment and the reasoning. Missing data is likewise not a
blocker: ship explicit, obviously-labelled placeholder content and wire the real source later.
(Precedent: ADRs 0016 + 0017 were amended exactly this way to unblock the Write-up tab.)

## The product

**Agentive-FeedEr** — a personal (non-commercial, single-user) tool that ingests AI news (focus:
new Claude features + agentic AI in development) from curated sources, AI-summarises each item
into a vertically scrollable **Reel** (Instagram-style) with a sourced mini practice example and
an action line, and distinguishes New / State-of-the-Art / Best Practice. Core value: **signal
over noise, actionability, retention** (a Skill Map gamification layer).

**Stack:** Next.js (App Router, TypeScript, `src/`, Tailwind **v4** — tokens live in
`src/app/globals.css`'s `@theme`, there is no `tailwind.config.js`), Drizzle ORM + `pg`, Postgres,
Anthropic SDK (Haiku default), zod, rss-parser, tsx, vitest, npm. `main` is the deploy branch
(Railway deploys it) and the single source of truth.

## Running locally (this is why you're a local session)

See **`docs/LOCAL_SETUP.md`** — Docker Postgres 16 + `npm run setup` (up → migrate → seed) +
`npm run dev`. **No `ANTHROPIC_API_KEY` is needed just to browse the UI**; the seed data covers
every redesigned surface. `APP_PROFILE=local` (ADR 0015) makes it structurally impossible to hit
Railway or the paid API — it throws on an illegal combination.

Postgres in a *remote* container stops on recycling; locally it's Docker, so
`npm run db:up` if the DB isn't there. Always `npm run db:migrate` before running tests.

## State at handoff

`main` is green: **build clean, typecheck clean, 363 tests passing** (was 214 at the start of
the previous session). Everything below is merged to `main` unless marked otherwise.

### Shipped this session
- **Production incident fixed.** Site-wide 500 caused by a Next.js dynamic-route conflict
  (`/skills/[id]/*` vs `/skills/[slug]/*`). The migration-drift hypothesis in the previous
  handoff was **wrong** — migrations already run as part of `start`.
- **Epic 15 — Topic Clustering.** Match-or-Propose, `topic_clusters`, `reels.is_primary`,
  pipeline step, feed stack card ("N sources on this topic").
- **Epic 11 T11.1–T11.6 — Topic-Knowledge-Check.** Grounded `confidence` (few/some/strong),
  freshness/supersession LLM pass, propagation into feed/overview/saved, confirm-deprecation UI.
- **Epic 13 complete** (T13.7 admin sources list + enrich-error retry).
- **Epic 10 Stage 1 — Reel Verifier.** `reels.caveat` + `caveat_checked_at`, fidelity/skepticism
  critic pass, pipeline wiring, ⚠️ display + feed/overview hide toggle.
- **ADR 0021** — Experience Reports in Topic Clusters (grilled; see below).
- **Epic 18 Phase 1 (T18.1–T18.7)** — the UX redesign's card + skills layer (see below).

### Epic 18 — UX implementation (the current focus)
Plan: `docs/plan/epic-18-ux-implementation.md`. Design source:
`docs/specs/2026-07-24-ux-gamification-design.md` + ADR 0016 + **the two accepted prototypes in
`docs/specs/prototypes/`, which are the VISUAL SOURCE OF TRUTH** (read that folder's README:
where prose and prototype disagree about *looks*, the prototype wins).

**Phase 1 — done (T18.1–T18.7):** font-override bug fixed (the app was loading Geist and
rendering Arial); design token system; Compact restyled (Action block removed, scores moved to
the header, `reel.skill` rendered for the first time since Epic 12, confidence differentiated,
caveat reduced to a marker); `ReelActions`/`ResurfaceCard` restyled; **four honest progress
states** (untouched no longer collapses into seen); **one shared `SkillRing`** (four rungs:
untouched 0 / seen .33 / tried .66 / mastered 1 + ★) + experimental-dot, resolving both
long-standing `TODO(UX pass)` markers; **Reel Detail** with push-nav and a generic tab system
(Write-up / Context / Skill).

**Phase 2 — DONE (T18.8–T18.14).** Route `loading`/`error`/`not-found` boundaries (there were
none on any of the 12 routes); header/tabbar height tokens; **bottom tab bar, 7 links → 4**
(fixed a real 375px overflow — Today · Feed · Skills · Library, Admin is the app-bar gear, and
the binding "new surfaces go in a hub, never the tab bar" rule is commented at `TabBar.tsx`'s
`TABS`); freshness indicator; shared empty state (the old one told the user to run
`npm run job:daily`); back-affordance rule; optimistic mutations over the existing single
write path.

**Epic 18 is complete.** Build green, typecheck clean, **363/363 tests**.

## Binding conventions (violating these is a review failure)

- **ADR 0015 — executor seam.** Every LLM step goes through an **injected `Executor`**
  (`src/lib/executor/`), never `callStructured`/the API directly, so it works under both `api` and
  `claude-code`. Mandatory per step: injected executor, wiring through the one executor resolved in
  `pipeline.ts`, **zod-validated** output, unit test with a **mocked** caller.
- **ADR 0016 — reserved colours, one meaning each:** `--accent` (links/focus/tried), `--action`
  (sourced action line, skill badge, mark-as-tried), `--gold` (**mastered only**, must stay rare),
  `--caution` (**`caveat` + freshness/supersession only** — never neutral info). **One status-ring
  component, three call sites**; no call site re-invents it.
- **ADR 0003** (null over hallucination) and **ADR 0005** (sourced-only) are binding.
- **No new dependencies.** English everywhere (code, comments, commits, UI, new docs).
- Pipeline steps are per-item try/catch and **never abort the run**.

## Known traps (learned the hard way this session)

1. **Check `main` before writing an ADR.** Two sessions collided on number 0021.
   `docs/adr/README.md` now documents the rule: check *all remotes*, and on collision the later
   merge renumbers. Highest ADR at handoff: **0023**.
2. **Re-read the design doc before implementing from it.** It was revised mid-session and the
   Action-block decision *reversed*. A spec written from an earlier read was stale within hours.
3. **Client/server boundary — this bit FIVE times in one epic.** Making a component
   `"use client"` and then **value**-importing anything from a DB-backed module pulls
   `pg`/`dns`/`fs` into the browser bundle and breaks `next build`, often far from the edit that
   caused it. **Established fix, use it by default:** split into a pure vocabulary module with no
   DB imports (`src/lib/skills/progressStatus.ts`, `src/lib/experienceReportTypes.ts`), have the
   DB-backed module import it for local use *and re-export it* so server-side callers are
   untouched, and point Client Components at the pure one. `import type` is always safe. If a
   layout genuinely must read the DB, `export const dynamic = "force-dynamic"`. Full write-up at
   the end of `docs/plan/epic-18-ux-implementation.md`.
4. **Subagents can lose everything to a rate limit.** Instruct them to **commit and push after
   each task**, never batch to the end.
5. **Verify subagent claims.** One shipped the *wrong* ring: it used the reel-card prototype's
   three-rung model, leaving untouched and seen both at `frac: 0` — silently defeating the whole
   point of T18.4. The binding prototype for §5.1 was `skill-constellation.html`, which has four
   rungs. Read the prototype yourself.

## Open decisions — yours or the user's, not a subagent's

- **`/` is still the Feed.** Making Today the landing route is flagged in design §10.1 as an open
  **product** decision. Ask, don't assume.
- **ADR 0017 decisions 2–4** (the enrichment pass that fills `reels.writeup`) remain *proposed* and
  want a grill. Decision 1 (the field) + the tab are accepted and built; `writeup` is NULL
  everywhere and the tab shows an explicit placeholder.
- **ADRs 0018 (Guides), 0019 (Actionables), 0020 (constellation layout)** — all *proposed*, all
  need a strong-model grill; each changes schema and/or adds a pipeline pass. §9.9 warns the
  constellation is "a beautiful shell over thin content" before Guides exist, so **build Guides
  before the constellation**.
- **ADR 0022 (retire SOTA)** — *proposed*, and gates itself on Guides shipping. `/overview` keeps
  SOTA for now.
- **Epic 11 T11.7** — fully grilled and planned (ADR 0021: match-only, primary by construction,
  one distinct author = one voice) with sub-tasks **T11.7a–e ready to delegate**. T11.8 (external
  web corroboration) still needs its own ADR.
- **Epic 10 T10.8** — overclaim flag for experience reports, grilled and ready to delegate
  (rule B only; a report has no source to be faithful to).
- **Epic 14** (source health), **16** (nightly refactoring agent), **8** (agentic deep-dive) —
  parked, each needs a grill.
- **Trust tag** (Official/Independent/Community) — out of scope; no source-authority data exists
  and §8.3 itself questions whether it earns its place.
- **future-todos T7** — curator/user system with trust-weighted evaluation (parked by the user).

## Deliberate deviations already recorded (don't "fix" them blindly)

- **`caveat`:** minimal `--caution` marker in Compact, full text in the Context tab. Compact was
  tightened to "meta row, badge row, title, summary, nothing else", but silently demoting a
  shipped trust warning into a tab is a visibility regression.
- **Write-up tab ships with placeholder content** and is **never hidden** (the §2.2 hiding rule
  governs Context and Skill only). Placeholders must be *unmistakably* placeholders — never
  invented realistic prose, never silently re-showing `summary` as if it were new.

## Suggested start sequence

1. Get local running (`docs/LOCAL_SETUP.md`) and **actually look at the redesign** — that was the
   stated reason for building it: feel how the surfaces flow together. **Note: the Docker step is
   the one thing never executed** (the sandbox blocks Docker Hub pulls by network policy), so if
   anything breaks, `npm run db:up` is the least-tested step. Migrations-from-zero and the seed
   *are* verified.
2. Then either: grill **ADR 0017** (write-up generation scope) so the Write-up tab gets real
   content instead of its placeholder — the most directly visible win; or delegate the
   already-planned **T11.7a–e** + **T10.8**; or grill **ADR 0018 (Guides)**, the load-bearing one
   everything in design §9 leans on.
3. Housekeeping worth doing early: one **pre-existing** eslint error (`react-hooks/purity`,
   `Date.now()` during render in `src/app/overview/page.tsx:43`) — not from Epic 18, verified by
   stashing. `npm run build`/`npm test` are the DoD gates and both pass.

## Durable record

`CLAUDE.md` (working agreement, branch strategy, design process, executor + English conventions) ·
`CONTEXT.md` (DE glossary) + `CONTEXT.en.md` (EN domain language) · `docs/adr/0001–0023` +
`docs/adr/README.md` (numbering rules) · `docs/plan/README.md` (epic status table) +
`epic-*.md` + `future-todos.md` · `docs/specs/` (incl. the UX design doc and
`prototypes/` — the visual source of truth).
