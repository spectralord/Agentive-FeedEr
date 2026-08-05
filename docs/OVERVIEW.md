# Overview — every ADR and Epic, one page

> **Purpose:** the single place to see *what exists, what state it is in, and what is worth doing
> next* — without opening 28 ADRs and 24 epic files to reconstruct it.
> **Ordered by priority, not by number.** Numbers are allocation order and carry no meaning;
> reorder the sections here freely as priorities change.
>
> Last reconciled against the files **and the live DB**: **2026-08-03**.
> Counts below are point-in-time; re-query before trusting them for a decision.
> **Rule: update this file in the same commit that changes an ADR status or finishes an epic.**
> The per-file status lines remain authoritative; this page is a map, and a map that lies is worse
> than no map (this project has had three stale status tables).

---

## 1. Do next

| What | Kind | Why now |
|---|---|---|
| **Curate the 107 pending skill proposals** (`/skills` → New Skills) | Owner task, no code | **The actual bottleneck.** `reels.skill` is only set for *confirmed* nodes, so the Skill tab stays hidden on most Reels and the Skill Map stays thin. Also the precondition for Guides ever becoming buildable. |
| **Epic 22 — Writing assistance** | Ready to delegate | ADR 0026 accepted + planned; smallest buildable unit on the board |
| **SkillTagger's 101 failures** | Bug, uninvestigated | Last run: 173 processed, 4 matched, 68 proposed, **101 failed**. Unexplained. |
| **Constellation rework** | Owner feedback, needs an ADR 0020 amendment | Dragging does not work; no connections between nodes; owner wants hub-and-spoke with themes as visible root nodes |
| **Actionables content quality** | Prompt work | The action reads as "look at the source", not a real task. Three options recorded in ADR 0019's feedback section. |

## 2. Built and live

The app runs on a **real 172-Reel corpus** (no fixtures). 475 tests / 72 files.

| Epic | What it gave you | ADRs |
|---|---|---|
| 0–5 | Skeleton, ingestion, enrichment, Feed, Today, Overview | 0001–0006 |
| 6 | Saves, feedback, resurfacing | — |
| 9 | Experience Reports | 0007 |
| 10 | Content verifier (stage 1) — the `caveat` | 0011 |
| 11 | Topic knowledge-check — corroboration + freshness | 0012 |
| 12 | SkillTagger (Match-or-Propose) | 0009 |
| 13 | Admin console + manual pipeline trigger | 0010 |
| 15 | Topic clustering | 0013 |
| 17 | Execution modes (trigger × executor, profiles) | 0015 |
| 18 | The UX redesign — tokens, tabs, 4-item nav, hubs | 0016, 0023 |
| **19** | **Write-up on demand**, on your Claude subscription | 0017, 0024 |
| **20** | **Actionables + evidenced progress track** | 0019 |
| **21** | **Constellation stage (a)** + closed theme vocabulary | 0020 |

## 3. Decided, not built

| Item | State | Blocked by |
|---|---|---|
| **ADR 0018 — Skill Guides** | Accepted, **build gated** | Corpus: nodes hold too few items to synthesise from. Decision 6 is the gate. |
| **ADR 0026 — Writing assistance** | Accepted, **planned** → Epic 22 | Nothing. Ready. |
| **ADR 0021 / Epic 11 T11.7a–e** | Grilled, ready to delegate | Nothing — no plan file written yet |
| **Epic 10 T10.8** — overclaim flag | Grilled, ready to delegate | Nothing — no plan file written yet |
| **ADR 0022 — Retire SOTA** | Proposed | Gated on Guides *shipping*, which is gated on corpus |

## 4. Open questions and parked ideas

| Item | State | Note |
|---|---|---|
| **ADR 0028 — Curator inbox / approval gate** | Proposed, **flagged for a design session** | Two of four parts don't exist: no rationale field on enrichment output, no lifecycle state on Reels. Tension with ADR 0004. |
| **ADR 0025 — Deferred task queue** | **Reopened 2026-08-03**, low priority | Rejected, then reopened: from *inside* a Claude Code context the executor cannot spawn a nested `claude`, so there is no synchronous path at all. Needs a second grill. |
| **ADR 0027 — Node seeding** | Deferred | ADR 0001 collision *dissolved* (user-supplied URLs are already permitted). Blocked on Epic 8 owning the fetching. |
| **Epic 8** — agentic Deep-Dive | Parked, needs grill | Owns fetching; ADR 0027 waits on it |
| **Epic 14** — source health | Parked, needs grill | |
| **Epic 16** — nightly refactoring agent | Parked, needs grill | Interacts with ADR 0025 |
| **T7 / T8** — curator trust + approval | Ideas | Compose: T7 is *who* gives input, T8 is *when* (pre/post publication) |
| **T9** — click-to-explain glossary | Idea | Tension with ADR 0005 (a definition isn't sourced) |
| **T10** — token/cost accounting | Idea | **Cheap** — both executors already return usage and it is discarded |

## 5. The binding rules (violating these is a review failure)

Short form. Full text in the named ADRs.

- **ADR 0015 — executor seam.** Every LLM step takes an **injected** `Executor` defaulting to
  `callStructured`. Never call the API directly. zod-validate the output. Unit-test with a mocked
  caller.
- **ADR 0016 — reserved colours, one meaning each.** `--accent` links/focus/tried · `--action`
  sourced action + skill badge · `--gold` **mastered only** · `--caution` **caveat + freshness only**.
  No raw `zinc-*`/`amber-*`/`emerald-*` in new code. Dark-only (decision 4).
- **ADR 0003 — null over hallucination.** ADR 0005 — sourced-only.
- **ADR 0023 — four tab destinations, max.** New surfaces go in a hub, never on the tab bar.
- **No new runtime dependencies.** English everywhere. Pipeline steps never abort the run.
- **`src/lib/env.ts` is server-only** — calling `env()` from a client component throws at hydration.
  Six occurrences on record.

## 6. How the three artifact types work

- **T** (`docs/plan/future-todos.md`) — a parked idea. Cheapest record. **Never built directly.**
- **ADR** (`docs/adr/`) — a decision *and its reasoning*. Binding once accepted. Written when a
  future session would otherwise repeat a rejected option.
- **Epic** (`docs/plan/epic-N-*.md`) — the buildable unit: tasks with verification steps, written
  for a subagent to execute cold.

Flow: `T → grill → ADR → plan → Epic → delegate → review → merge`.

**Two rules learned the hard way:** check *all remote branches* before picking an ADR number (two
sessions once both wrote 0021), and never write an epic plan for an ADR whose input data does not
exist yet (ADR 0018's build gate is exactly this).
