# Agentive-FeedEr — Session Handoff / Mega-Prompt

> Written 2026-08-01 at the end of a local session. Supersedes the 2026-07-25 handoff
> (still in git history at `d4ce5f3` if you need it).
> **Start your session with `Agentive-FeedEr/` as the working directory** — see §0.

---

## 0. Read this first — three environment facts that will otherwise waste your time

1. **Use Node 20.19.5.** `nvm use` in the repo root (`.nvmrc` pins it). The docs used to say
   "Node 22+", which is wrong in an expensive way: `@rolldown/binding-*` (vitest 4 → vite 8)
   requires `^20.19.0 || >=22.12.0`, and the commonly-installed **22.8 falls in the gap**. npm
   then *silently skips* the native binary and `npm test` dies with "Cannot find native binding" —
   an error that impersonates the well-known npm optional-deps bug, so the obvious fix (delete
   `node_modules`, reinstall) loops forever.

2. **Your working directory must be the repo itself**, not its parent. The project's agents live
   in `.claude/agents/` and resolve from the session cwd — a session started in
   `~/Documents/AIProjects/` cannot see `design-review` or `design-partner`.

3. **`npm test` no longer wipes the dev database** (fixed 2026-07-27, `9e34ab6`). It runs against
   `TEST_DATABASE_URL` (`feedr_test`), auto-created and migrated. If your `.env` predates that,
   copy the `TEST_DATABASE_URL` line out of `.env.example` or the suite aborts by design.
   Verified: 16 reels in `feedr_dev` before a full run, 16 after.

Local startup: `npm run db:up` (Docker Desktop must be running) → `npm run dev`. No
`ANTHROPIC_API_KEY` is needed to browse the UI; the seed covers every surface.

---

## 1. Git auth — resolved, but note the local-only setup

Everything is **pushed**; `origin/main` is at `4a6d265`. Railway has the fixes.

How it works on this machine, because it is not the default and a fresh clone will not inherit it:
- **The remote is SSH** (`git@github.com:spectralord/…`), not HTTPS. HTTPS is unusable here — the
  macOS keychain hands git a `tjesgarz` work credential, and GitHub 403s it against the personal
  `spectralord` repo.
- **`~/.ssh/config` forces `IdentityFile ~/.ssh/id_ed25519` for `Host *`**, which is *not* the key
  registered with GitHub. The working key is **`cfp_key`**. Rather than edit the user's global SSH
  config, this repo carries a local override:
  `core.sshCommand = ssh -i ~/.ssh/cfp_key -o IdentitiesOnly=yes`
  (`git config --local`). If pushes suddenly fail with `Permission denied (publickey)`, that
  setting is the first thing to check — and it lives in `.git/config`, so it is **not** cloned.

Commits from this machine are authored `tjesgarz <tristan.jesgarz@cofinpro.de>` (work identity).
The user was asked and explicitly did not care. Do not "fix" this retroactively.

---

## 2. The product

**Agentive-FeedEr** — a personal (single-user, non-commercial) tool that ingests AI news (focus:
new Claude features + agentic AI in development), AI-summarises each item into a vertically
scrollable **Reel** with a sourced mini practice example and an action line, and distinguishes
New / State-of-the-Art / Best Practice. Core value: **signal over noise, actionability,
retention** (a Skill Map gamification layer).

**Stack:** Next.js 16 (App Router, TypeScript, `src/`, Tailwind **v4** — tokens live in
`src/app/globals.css`'s `@theme`, there is no `tailwind.config.js`), Drizzle ORM + `pg`, Postgres,
Anthropic SDK (Haiku default), zod, rss-parser, tsx, vitest, npm. `main` is the deploy branch.

---

## 3. State at handoff

Local `main`: **build clean, typecheck clean, 375 tests across 60 files green.** Epic 18 (the UX
redesign) is complete. Everything below is merged locally; **none of it is pushed.**

### Shipped this session
- **Client/server boundary bug (6th occurrence).** `isNew()` read `env().NEW_DAYS` from inside the
  client bundle (`ReelCardBody` ← `ReelStackCard` `"use client"`). `env()` validates the
  server-side zod schema; `DATABASE_URL` is undefined in the browser, so every feed card threw
  during hydration. Now a **required** `newDays` prop resolved by Server Components.
- **BLOCKER: white background.** `:root` still carried Epic 0's `#ffffff` + a
  `prefers-color-scheme` override. `globals.css`'s unlayered `body` rule beats Tailwind's layered
  `.bg-ground`, so the app rendered **white for every visitor not in OS dark mode**, with
  `--color-ink` (#eef1f2) text on it. Now `rgb(10,13,16)` in all three schemes.
- **BLOCKER: Reel Detail was a trap.** The overlay was `absolute` inside a `relative` `<article>`,
  painting beneath the fixed app bar (z-20) and FilterBar (z-10). Back and all three tabs were
  covered — a Playwright `click()` on Back *timed out*. Now `fixed … z-30`.
- **Playwright committed as a devDependency** (owner's decision, reversing the repo's previous
  "deliberately not committed" stance), with all three contradicting docs updated.
- `.nvmrc`, `.claude/settings.json` (narrow read-only permission allowlist), Epic 18 status table
  corrected, LOCAL_SETUP verification notes reconciled with the split-test-DB work.

### The lesson worth internalising
All three bugs above were invisible to `npm run build`, typecheck and 363 green tests. Two were
found only by **rendering the app and looking at it**. Generalised rule, now recorded in
`docs/plan/epic-18-ux-implementation.md`: **`src/lib/env.ts` is a server-only module — treat
calling `env()` exactly like importing `pg`.** The hazard is not limited to imports that drag in
Node builtins; any server-only *runtime* dependency behaves this way, and the build cannot catch it.

---

## 4. Your first task: a full-project sweep

The user has been away and wants a **thorough, wide review** before new feature work. Take your
time; this is explicitly not a quick pass.

**Use the project's own agents** (`.claude/agents/`; they are well-specified and start cold by
design):
- `design-review` — frontend vs. the accepted design. **Playwright is now installed**, so rung 1
  (screenshots) is available and expected: it must actually render and *look*, not review from
  source. Its spec is binding — follow its Procedure and Output format.
- `design-partner` — for design questions rather than conformance checks.

**Verify agent findings yourself before acting.** Precedent: one subagent shipped the wrong ring
model; another's hit-test conflated "off-screen" with "blocked" and overstated a finding. Re-open
the file and re-run the check.

**Sweep for, at minimum:**
1. **Known-open findings** (§5) — confirm they still hold.
2. **Doc ↔ code inconsistencies.** This project's highest-value findings have repeatedly been
   *the docs being wrong*, not the code. The status table in `docs/plan/README.md` claims to be
   the single source of truth and has been stale twice.
3. **ADR conformance**, especially ADR 0016's reserved colours (one meaning each).
4. **Dead scope** — `future-todos.md`, parked epics (8, 14, 16), and ADRs still *proposed*
   (0017 decisions 2–4, 0018, 0019, 0020, 0022) that may now be decidable or droppable.
5. **Schema vs. UI** — this project has twice designed UI against content the pipeline does not
   produce. Check `src/db/schema.ts`, not the design doc.

Then **produce a prioritised, ordered TODO list with a briefing**: where the project stands, what
should happen next and in what order, and what needs a *user decision* rather than an
implementation. Distinguish "not built yet" (not a defect) from "built and wrong".

---

## 5. Known-open findings (2026-08-01 design review, rung 1 / screenshots)

Verified, unfixed, deliberately left for this session:

| Sev | Finding | Where |
|---|---|---|
| MAJOR | Neutral text uses the caution colour — ADR 0016 names this exact bug in its own rationale | `src/app/today/page.tsx:48` (`text-amber-300`, "incl. yesterday") |
| MAJOR | "Weak signal" filter chips use amber for a neutral toggle | `FilterBar.tsx:105`, `OverviewFilterBar.tsx:157` |
| MAJOR | ~130 raw `zinc-*`/`amber-*`/`emerald-*` literals outside the restyled Reel card; visible as a seam on `/skills` and `/saved` | many |
| MAJOR | **No `focus-visible` states anywhere** (zero occurrences); `--accent` is reserved for focus rings and never used as one | whole codebase |
| MINOR | ReelActions buttons are 38×26px, under the ~40px touch floor | `ReelActions.tsx:31` |
| — | Pre-existing eslint error: `react-hooks/purity`, `Date.now()` during render | `src/app/overview/page.tsx:43` |

---

## 6. Design drift — needs a USER decision, not a fix

Places where the **spec or an ADR is wrong**, not the code. Do not "fix" these silently.

1. **Nothing specifies Detail's relationship to the shell chrome.** §10.1, §10.9 and ADR 0023 each
   describe the fixed app bar, the FilterBar, and a Detail that "slides in over Compact" — none
   says which is on top. The BLOCKER in §3 was the direct consequence. This session chose
   **full-frame Detail covering the chrome**, because the prototype renders Detail filling
   `.reel-slot` (there the whole phone screen, with no app bar outside it). Defensible, but never
   ratified. **If the user wanted Detail docked beneath the chrome, one className changes.** Then
   amend ADR 0023.
2. **ADR 0016's token mandate has no scope boundary.** It reserves the colours "project-wide" with
   no raw palette classes "anywhere going forward", but Epic 18's task list only names specific
   components — so the epic is legitimately complete while ~130 literals remain, and the ADR reads
   as violated by a correctly-executed epic. Either grandfather legacy surfaces until touched, or
   add a retokenisation task.
3. **The dark-first decision lives only in `prototypes/README.md`.** ADR 0016 defines fourteen
   tokens without ever stating the app is dark-only — which is *why* T18.1 deliberately left the
   Epic-0 `prefers-color-scheme` pair alone and shipped the white-background bug. **It belongs in
   ADR 0016.**

Standing instruction from the user (2026-07-25, still binding): where a design conclusion
contradicts an earlier ADR, **amend the ADR** — do not block the change. Missing data is likewise
not a blocker: ship obviously-labelled placeholder content and wire the real source later.

---

## 7. Open decisions, parked work

- **`/` is still the Feed.** Making Today the landing route is an open *product* decision (§10.1).
- **ADR 0017 decisions 2–4** (the enrichment pass filling `reels.writeup`) remain *proposed* and
  want a grill. Decision 1 + the tab are built; `writeup` is NULL everywhere and the tab shows an
  explicit, deliberate placeholder. **Grilling this is the most directly visible win available.**
- **ADRs 0018 (Guides), 0019 (Actionables), 0020 (constellation layout)** — all *proposed*, each
  changes schema and/or adds a pipeline pass. §9.9 warns the constellation is "a beautiful shell
  over thin content" before Guides exist, so **build Guides before the constellation**.
- **ADR 0022 (retire SOTA)** — *proposed*, gates itself on Guides shipping.
- **Epic 11 T11.7** — fully grilled, sub-tasks **T11.7a–e ready to delegate** (ADR 0021).
  T11.8 (external web corroboration) still needs its own ADR.
- **Epic 10 T10.8** — overclaim flag for experience reports, grilled and ready to delegate.
- **Epics 14 (source health), 16 (nightly refactoring agent), 8 (agentic deep-dive)** — parked,
  each needs a grill.

---

## 8. Binding conventions (violating these is a review failure)

- **ADR 0015 — executor seam.** Every LLM step goes through an **injected `Executor`**
  (`src/lib/executor/`), never `callStructured`/the API directly. Mandatory per step: injected
  executor, wiring through the one executor resolved in `pipeline.ts`, **zod-validated** output,
  unit test with a **mocked** caller.
- **ADR 0016 — reserved colours, one meaning each:** `--accent` (links/focus/tried), `--action`
  (sourced action line, skill badge, mark-as-tried), `--gold` (**mastered only**), `--caution`
  (**caveat + freshness/supersession only** — never neutral info).
- **ADR 0003** (null over hallucination) and **ADR 0005** (sourced-only) are binding.
- **No new runtime dependencies.** (`playwright` is an explicitly-dated **devDependency**
  exception for the design-review screenshots — see `docs/plan/README.md` §1.3.)
- English everywhere: code, comments, commits, UI, new docs.
- Pipeline steps are per-item try/catch and **never abort the run**.
- **Model split (CLAUDE.md):** the strong session model owns conception, architecture, ADRs, plan
  maintenance and review; implementation is delegated to Sonnet subagents on per-epic feature
  branches (`claude/epic-<N>-<short>`). Subagents **commit and push after each task** — a rate
  limit otherwise destroys uncommitted work.

---

## 9. Traps learned the hard way (do not re-learn these)

1. **Check `main` before writing an ADR.** Two sessions once collided on number 0021.
   `docs/adr/README.md` has the numbering rule. Highest ADR at handoff: **0023**.
2. **Re-read the design doc before implementing from it.** It was revised mid-session once and the
   Action-block decision *reversed*; a spec written from an earlier read was stale within hours.
3. **The client/server boundary has now bitten six times.** Established fix: split into a pure
   vocabulary module with no DB imports, have the DB-backed module re-export it, point Client
   Components at the pure one. `import type` is always safe. **And: `env()` is server-only.**
4. **Verify subagent claims.** Two separate cases of confidently-wrong subagent output are on
   record. Re-open the file yourself.
5. **`npm run db:seed` is destructive** (TRUNCATE first). A count query issued mid-seed reports
   zeros — that is a race, not a failure. Re-query once it returns.
6. **Screenshots beat source review for UI.** Two BLOCKERs survived a green build, green typecheck
   and 363 passing tests. `scripts/design-screenshot.mjs` + reading the PNGs back is the only
   thing that caught them.

---

## 10. Durable record

`CLAUDE.md` (working agreement, branch strategy, design process, executor + English conventions) ·
`CONTEXT.md` (DE glossary) + `CONTEXT.en.md` (EN domain language) · `docs/adr/0001–0023` +
`docs/adr/README.md` (numbering rules) · `docs/plan/README.md` (epic status table) +
`epic-*.md` + `future-todos.md` · `docs/specs/` (incl. the UX design doc and **`prototypes/` — the
visual source of truth**) · `.claude/agents/` (design-review, design-partner, README).
