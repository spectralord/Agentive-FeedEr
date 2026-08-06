# Agentive-FeedEr — Development Plan (Master)

- Date: 2026-07-21
- Basis: `docs/specs/2026-07-21-agentive-feeder-design.md` + ADRs 0001–0006 + `CONTEXT.md`
- Target audience of this plan: **an executing model/developer** who can implement the
  Epics piece by piece without making design decisions of their own.

---

## 1. Working instructions for the executing model (binding)

1. **Keep the order:** Epics in numeric order, tasks within an epic in order. A task
   only counts as done once its **verification** has been run successfully.
2. **One commit per task.** Commit format: `feat(epic-N): TN.x <short description>`
   (or `chore`/`fix` where appropriate). After each task: check off the checkbox in
   the epic file and commit it along.
3. **Don't invent anything.** The ADRs are binding (esp. ADR 0003 "null instead of
   hallucination", ADR 0005 "Sourced-only"). No additional scope, no additional
   libraries beyond the ones named here, unless technically unavoidable — in that
   case document it under "Deviations" in the epic file.
   *Exception, deliberately decided 2026-08-01:* `playwright` as a pure
   **devDependency** for `scripts/design-screenshot.mjs` (design review agent).
   Rationale in the script header. Applies to tooling only — for **runtime**
   deps the rule remains strict and unchanged.
4. **When unclear:** don't guess. Note the deviation/question in the epic file under
   "Deviations/Questions", choose the most conservative interpretation, keep going.
5. **After each epic:** `npm run build` and `npm test` must be green; enter a short
   status report in the status table below.
6. **User actions** (e.g. confirming Railway account, API keys, feed URLs) are
   marked as such — don't simulate them, prompt the user instead.
7. **Branch:** development continues on the existing working branch and is pushed
   after each epic.

## 2. Conventions

- **Language:** **English everywhere** — UI text, generated content, code, comments,
  identifiers, commits, new docs (switched over 2026-07-24, T3; domain glossary
  `CONTEXT.en.md`).
- **Stack (fixed):** Next.js (App Router, TypeScript, `src/` layout, Tailwind CSS),
  Drizzle ORM + `pg` (node-postgres), Postgres, Anthropic SDK (`@anthropic-ai/sdk`),
  `rss-parser`, `zod`, `tsx` (job runner), `vitest` (tests). Package manager: **npm**.
- **DB naming:** snake_case tables/columns, Drizzle schema in
  `src/db/schema.ts`, migrations via `drizzle-kit` in `/drizzle`.
- **Job error handling:** try/catch per source/item — one error never aborts the
  overall run; log a summary at the end (ok/failed counts).
- **No authentication in the MVP** (single user, not publicly linked).

## 3. Project structure (target)

```
/profile.md                  # Developer profile (relevance context)
/drizzle/                    # generated migrations
/src
  /app
    /page.tsx                # Feed (Epic 3)
    /today/page.tsx          # Today's Top-N (Epic 4)
    /overview/page.tsx       # Overview/SOTA/history (Epic 5)
    /saved/page.tsx          # Saves (Epic 6)
    /skills/page.tsx         # Skill map (Epic 7)
    /api/health/route.ts
    /api/interactions/route.ts        # Epic 6
    /api/reels/[id]/deepen/route.ts   # Epic 8
  /components                # ReelCard, FilterBar, Badges, ...
  /db
    /schema.ts
    /client.ts
  /lib
    /env.ts                  # zod-validated env vars
    /claude.ts                # Anthropic client wrapper
    /sources.ts               # Source registry (code = source of truth)
    /ingestion/               # Fetcher + runner (Epic 1)
    /enrichment/              # Schema, prompt, runner (Epic 2)
    /ranking.ts               # Top-N score (Epic 4)
    /labels.ts                # derived labels (Epic 5)
  /jobs
    /daily.ts                 # daily pipeline entry point
```

## 4. Environment variables (complete list)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection |
| `TEST_DATABASE_URL` | only `npm test` | — | Separate test database (`feedr_test`). Integration tests do `TRUNCATE`, so they never run against `DATABASE_URL`; vitest aborts instead of falling back. Created and migrated on the first test run. See `docs/LOCAL_SETUP.md`. |
| `ANTHROPIC_API_KEY` | only job/enrichment | — | Claude API. The web process boots fine without it (empty = unset); enrichment/cron need it. |
| `ANTHROPIC_MODEL` | no | `claude-haiku-4-5-20251001` | Enrichment model |
| `DEEPEN_MODEL` | no | `claude-sonnet-5` | Deepening (Epic 8) |
| `MAX_ENRICH_PER_RUN` | no | `100` | Cost guard per run |
| `QUALITY_THRESHOLD` | no | `60` | Feed hides anything below this |
| `TOP_N` | no | `3` | Today's Top-N |
| `NEW_DAYS` | no | `7` | "New" window in days |
| `OWNER_NAME` | no | `Ich` | Author display name for own experience reports (Epic 9) |
| `ADMIN_TOKEN` | no | — | Enables the admin console (Epic 13). Unset ⇒ admin disabled. |
| `APP_PROFILE` | no | **`local`** | Execution profile (Epic 17/ADR 0015): `local` (manual+claude-code, never Railway/API) or `cloud` (railway-cron+api). **Default flipped from `cloud` to `local` on 2026-08-01** (`src/lib/env.ts`, ADR 0015 amended): `cloud` implies `executor=api`, i.e. the **paid** Anthropic API — an unset profile used to mean "spend money and accept a cloud cron job". `cloud` still works but must now be set **explicitly**. The default is pinned by a test in `src/lib/env.test.ts`, because all `resolveExecutionConfig` tests pass `APP_PROFILE` explicitly, so a silent flip back would otherwise go unnoticed. |
| `PIPELINE_EXECUTOR` | no | profile-dependent | Override: `api` \| `claude-code` (quota via local CLI). |
| `PIPELINE_TRIGGER` | no | profile-dependent | Override: `railway-cron` \| `claude-code-cron` \| `manual`. Illegal combination throws. |
| `CLUSTER_WINDOW_DAYS` | no | `30` | Epic 15: "active window" for cluster match candidates (`last_matched_at` within it). |
| `MAX_CLUSTER_CANDIDATES` | no | `40` | Epic 15: cost/context guard, max candidate clusters per reel prompt. |
| `CONF_SOME_MIN` | no | `2` | Epic 11: from this many independent pieces of evidence (distinct source, `is_primary=true`) ⇒ `confidence=some`. |
| `CONF_STRONG_MIN` | no | `4` | Epic 11: from this many independent pieces of evidence ⇒ `confidence=strong`. |
| `KNOWLEDGE_CHECK_MODEL` | no | `ANTHROPIC_MODEL` | Epic 11: model override for the freshness/supersession LLM pass. |

`.env.example` lists all variables; `src/lib/env.ts` validates them with zod
(defaults centralized there, hardcoded nowhere else).

## 5. Definition of Done (global)

An epic is done when:
- all tasks checked off, verifications run,
- `npm run build` and `npm test` green,
- no ADR violation (short check against ADR 0001–0006),
- status table updated, committed, and pushed.

## 6. Epic overview & status

| Epic | File | Tier | Status |
|---|---|---|---|
| 0 — Project skeleton | `epic-0-skeleton.md` | MVP | ✅ done (Railway deploy = user action open) |
| 1 — Ingestion | `epic-1-ingestion.md` | MVP | ✅ done (feed URLs outside of GitHub can only be fully verified during the first Railway/local run — see Deviations) |
| 2 — Enrichment | `epic-2-enrichment.md` | MVP | ✅ done (live-run sample with API key = user action open) |
| 3 — Reel feed UI | `epic-3-feed-ui.md` | MVP | ✅ done (verification via `curl` against `npm run start` instead of manually in Safari/iPad — see Deviations) |
| 4 — Today's Top-N | `epic-4-top-n.md` | MVP | ✅ done (verification via `curl` against `npm run start` instead of manually in Safari/iPad — see Deviations) |
| 5 — Overview/SOTA | `epic-5-overview.md` | near-MVP | ✅ done (verification via `curl` against `npm run start` instead of manually in Safari/iPad — see Deviations) |
| 6 — Saves/Feedback/Resurfacing | `epic-6-interactions.md` | Fast-Follow | ✅ done (see Deviations in `epic-6-interactions.md`) |
| 7 — Skill map | `epic-7-skill-map.md` | Vision | ✅ done (T7.1 schema `skill_nodes`/`user_progress`/`user_progress_notes`, T7.3 `/skills` page, T7.4 adoption log — 42 tests green across `src/lib/skills/` + SkillMap/SkillRing/SkillNodeDetail). **T7.2 (node aggregation) deliberately NOT built** — superseded by Epic 12's SkillTagger, documented as `⊘` in the epic file. Visual pass done separately in Epic 18 (T18.5, one shared ring component). Table status was incorrectly "open" until 2026-08-01 |
| 8 — Agentic deepening | `epic-8-deep-dive.md` | Vision | ☐ open |
| 9 — Experience section | `epic-9-experience-reports.md` | Fast-Follow | ✅ done (no real Markdown rendering without a new dependency — see Deviations in `epic-9-experience-reports.md`) |
| 10 — Content verifier | `epic-10-verifier.md` | Fast-Follow | ◑ Stage 1 done & tested (ADR 0011; T10.1–T10.4 — reel `caveat`, gated + idempotent critic pass, wired into the pipeline, ⚠️ display + feed/overview filter); **T10.8 grilled + buildable** (ADR 0021: overclaim flag for experience reports, rule B only — no clustering needed, hence stage 1); T10.6 resolved/split by ADR 0021; stage 2 → folded into Epic 11 |
| 11 — Topic knowledge check (freshness + corroboration) | `epic-11-sota-recheck.md` | Fast-Follow | ◑ T11.1–T11.6 done & tested (ADR 0012/0013); **T11.7 grilled + planned** (ADR 0021: match-only, primary by construction, one author = one vote; sub-tasks T11.7a–e, buildable); T11.8 (external web corroboration, needs its own ADR) still deferred |
| 12 — SkillTagger | `epic-12-skill-tagger.md` | Fast-Follow (before Epic 7) | ✅ done (T12.1–T12.6 all ☒: schema + pending status, enrichment only supplies the raw `skill_hint`, match-or-propose core, runner, trigger wired up, confirmation UI under `/skills` → `#new-skills`) — 15 tests green across `src/lib/skilltagger/`. Runs through the executor seam (ADR 0015). Table status was incorrectly "open" until 2026-08-01 |
| 13 — Admin console | `epic-13-admin-console.md` | Fast-Follow | ✅ done (T13.1–T13.7; cron button + status + source list/error retry; `ADMIN_TOKEN` in Railway = user action) |
| 14 — Source validation & review | `epic-14-source-health.md` | Fast-Follow (grill first) | ☐ parked (build "once everything else is in place") |
| 15 — Topic clustering (foundation) | `epic-15-topic-clustering.md` | Fast-Follow | ✅ done (ADR 0013; T15.1–T15.5 built & tested — see Deviations in `epic-15-topic-clustering.md`); precursor for Epic 11 |
| 16 — Refactoring agent (nightly Claude Code cron) | `epic-16-refactoring-agent.md` | Tooling/Vision (grill first) | ☐ parked (shares CC routine mechanics with Epic 17) |
| 17 — Execution modes (trigger × executor) | `epic-17-execution-modes.md` | Tooling/Vision | ◑ in progress (ADR 0015): T17.1–T17.5+T17.7 done & tested; T17.6 open (infra) |
| 18 — UX implementation (design pass) | `epic-18-ux-implementation.md` | Fast-Follow | ✅ done (ADR 0016 accepted). **Phase 1 done**: T18.1–T18.7 ✅ (tokens/font; compact restyle; ReelActions/ResurfaceCard restyle; four honest statuses; one ring component + `/skills`; reel detail push nav + write-up/context tab incl. `reels.writeup`, ADR 0017 decision 1; skill tab incl. "Mark as tried" through the same `setProgress` path). **Phase 2 partially done**: T18.9–T18.11 + T18.13 ✅ (header height token; bottom tab bar 7→4 + skills/library hubs, ADR 0023; freshness indicator in the app bar; back-affordance rule for non-tab pages). **Phase 2 done**: T18.8 (route boundaries loading/error/not-found), T18.12 (shared empty state), T18.14 (optimistic mutations) ✅ — Epic 18 thereby complete (build green; 364 tests at the time the epic closed, as of 2026-08-01: **377 tests / 60 files**). **Unblocked 2026-08-01:** ADR 0017 decisions 2–4 are **accepted**, and **ADR 0024** fixes the mechanism — write-up is generated *user-triggered per reel* via the existing `claude-code` executor (Claude Code quota, never the paid API), no batch, no gating. `writeup` stays NULL for anything nobody requested — that is now the **intended state**, not a gap. Buildable, not yet built. **Guides (ADR 0018) grilled + accepted 2026-08-01** — design is settled, but **build is deliberately locked** (decision 6): the nodes currently hold only 1–3 tagged reels each, nothing can be synthesized from that. This *decision-wise* unblocks 0020 (Constellation) and 0022 (SOTA retirement), but 0022 still needs guides to actually *run*. **Actionables (ADR 0019) grilled + accepted 2026-08-01 — and unlike 0018, immediately buildable**: the grill checked the premise against real data and it holds (8 reels with `action`, 7 of them actionable-ready, `action`/`effortTag` already render read-only in the detail skill tab). Net-new is just a completion table + one shared mutation. **Constellation (ADR 0020) grilled + accepted 2026-08-01**, split into two stages: (a) position schema + hash tier already renders a real constellation → **immediately buildable**, (b) the relaxation pass is locked on co-occurrence density (currently **one** pair in the entire corpus). **Precondition:** `skill_nodes.theme` must be migrated onto the 8 `THEMES` slugs (decision 6) — the DB contains free-text themes ("Agentic Workflows", "Cost & Performance") for which there is no map region. New: three view layers, themes = root nodes (decision 8). **Still blocked**: knowledge base, trust tag. **ADR 0025 (task queue) grilled 2026-08-03 → REJECTED**: `pipeline_runs` already covers ~80% of it (8 columns incl. status lifecycle, both timestamps, `summary` jsonb, `error`), a dispatcher would cut across ADR 0015's injected executor (**10** non-test modules), and there is exactly **one** candidate consumer (Epic 16), which is itself still parked. If Epic 16 gets built, it gets its own trigger. **ADR 0026 (writing assistance) grilled + accepted 2026-08-03** (narrowed to one consumer) → **Epic 22**, delegable. **ADR 0027 (node seeding) grilled 2026-08-03 → DEFERRED**: the ADR-0001 collision resolves itself (user-supplied seed URLs are already covered by "per source, on concrete demand"; only open web search would need a change). Practically blocked on Epic 8, which owns fetching and is itself parked — and the real bottleneck right now is 67 uncurated skill proposals, not missing content |
| 19 — Write-up on demand | `epic-19-writeup-on-demand.md` | Fast-Follow | ✅ **done** (ADR 0024; T19.1–T19.5, Sonnet subagent 2026-08-01, review by the strong model). `src/lib/writeup/` (prompt + zod schema + runner with injected executor), `POST /api/reels/[id]/writeup` incl. cloud guard (503 if executor is `api`), button in the write-up tab (idle → pending → done/error), guard at both levels pinned by test. Build/typecheck green, **393 tests / 64 files**, eslint 0. Rung-1 verified (button 143×40px, `--accent`, not obscured, overflow 0). **Open:** a real end-to-end run — the `claude` CLI is not logged in non-interactively, see "Deviations" in the epic file |
| 20 — Actionables & evidence track | `epic-20-actionables.md` | Fast-Follow | 📋 **plan done, delegable** (ADR 0019). No LLM pass needed — `reels.action`/`effort_tag`/`skill` are already populated (8/16 and 7/16 respectively) and render read-only in the detail skill tab. Net-new: `actionable_completions` (with **text snapshot**, decision 5), **one** shared mutation (§8.4), evidence counts, `effort_tag` filter. **Independent** of 19/21 |
| 21 — Constellation stage (a) | `epic-21-constellation-stage-a.md` | Vision | ✅ **done** (ADR 0020, stage a only; Sonnet subagent 2026-08-01). T21.1–T21.5 all ☒: theme vocabulary migrated onto the 8 `THEMES` slugs (Drizzle migration 0012, real DB CHECK constraint — off-vocabulary insert verified rejected — `seed-dev.sql` fixed, `THEME_LABELS` for the UI); `THEME_LAYOUT` (T21.2, 8 hand-placed, non-overlapping regions + exhaustiveness/overlap tests); position schema + `resolveNodePosition` three-tier resolution (T21.3, migration 0013); `SkillConstellation.tsx` (T21.4, renders next to the existing list view via `?view=constellation`, shares the `SkillRing`); drag-to-place desktop/iPad-only + reset (T21.5, `POST /api/skills/[slug]/position`). Two real bugs found only through the mandatory screenshot check (hash-tier collision → sunflower spiral; label text overlap at 375px → `assignLabelRows`), a third only through actual dragging in a live browser (reset button was nested inside the anchor, every click accidentally started a new drag). **424 tests / 67 files**, build/typecheck green, eslint 0. **Relaxation pass, view layer, and root creation remain explicitly out of scope** (not built) |
| 22 — Constellation rework (hub-and-spoke) | `epic-22-constellation-hub-and-spoke.md` | Vision | 📋 **plan done** (owner feedback on Epic 21, 2026-08-03). **T22.1 is a DECISION, not code**: the hub-and-spoke model contradicts the prototype (`.theme-ring`) and ADR 0020 decision 1, so it needs an ADR amendment first (decision 10). After that: theme hubs + spokes (the prototype's `.link` class finally gets used — the implementation currently renders **zero** `<line>` elements), make edit mode reachable, label crowding. **No drag bug**: dragging works, but the "Edit positions" button is `hidden md:inline-flex` and thus invisible below 768px. **Member↔member edges remain out of scope** (decision 7, one co-occurrence pair in the entire corpus) |
| 22 — Writing assistance | `epic-22-writing-assistance.md` | Fast-Follow | 📋 **plan done, delegable** (ADR 0026, grilled + accepted 2026-08-03, **narrowed to one consumer**). The grill checked the "two surfaces" premise: experience report authoring **exists and runs** (`experience_reports.body`), guide editing **does not** (no `skill_guides` table, ADR 0018 build-locked). Module stays reusable, only the UI is narrowed. Two intents ("improve", "shorten"), suggestion instead of replacement, context = **only the user's own text** (so ADR 0005 is trivially satisfied). Main constraint: `/experience/new` today is a plain server HTML form **with no client JS** — only the body field becomes a client component, the native POST stays untouched |
| — Vision backlog (optional) | `vision-backlog.md` | Vision | ☐ open |

**MVP = Epic 0–5 (done).** After that Fast-Follow: 6 (Saves), 9 (Experience), 12 (SkillTagger,
before 7). Vision: 7 (Skill map), 8 (Deepening), 10 (Verifier), 11 (SOTA re-check). 7–12 only
after explicit user go-ahead; 10 and 11 additionally only after their own grill.

### Delegation order for Epics 19–21 (as of 2026-08-01)

All three plans are done and **functionally independent** — there is no required order between
them. Practical recommendation:

1. **Epic 19 first** — smallest package, no schema change, and turns the app's most visible
   placeholder into real content.
2. **Epic 20 can run in parallel** — touches different files (skill tab action block + node page
   vs. write-up tab). Conflict risk in `ReelDetail.tsx` is real but small and lies in different
   tabs; if run in parallel, merge one first, then rebase the other.
3. **Epic 21 last** — largest package, the only one containing a **data migration** (T21.1), and
   §9.9 already warns not to expect the constellation "done" before the guides.

**Max. 2–3 concurrent subagents** (CLAUDE.md, design process), each on its own feature branch
`claude/epic-<N>-<short>`. Pull `git fetch origin main` before branching off. Review by the strong
model before every merge: build green, tests green, task verifications run, no ADR violation, no
new runtime deps, diff limited to the epic.

**Binding for all three:** screenshot verification is part of the Definition of Done, not
optional — in this project two BLOCKERs survived a green build, a green typecheck, and 363 green
tests and were **only** found by looking at rendered PNGs.

### Revised assumptions (grill session 2026-07-22)
See `docs/specs/2026-07-22-experience-reports-design.md` → "Revised assumptions". In short:
- **Actionable/To-Try** is the checkable progress unit (derived from reels *and*
  experience reports) — not reels/reports themselves. Affects Epic 6 ("tried") and Epic 7.
- **Skill nodes** additionally have a self-status ("I know this"/"already tried");
  self-declaration and actionable evidence exist side by side. Affects Epic 7.
- **Skill assignment** comes from the **SkillTagger (Epic 12)**, not from the enrichment
  pass and not from the user. Epic 7 T7.2 (node aggregation) is replaced/extended by
  Epic 12 — hence build Epic 12 **before** Epic 7.
