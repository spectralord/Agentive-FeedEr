# Overview — what's next, one page

> **Purpose:** the single place to see *what's in flight, what's blocked, and what's worth doing
> next* — the volatile, changes-every-week layer. For *how the system works* (accepted
> architecture, binding rules), see [`ARCH_SPEC.md`](ARCH_SPEC.md) instead — that content used to
> live here and has moved, so this page no longer needs a "Built and live" table.
> **Ordered by priority, not by number.** Numbers are allocation order and carry no meaning;
> reorder the sections here freely as priorities change.
>
> Last reconciled against the files **and the live DB**: **2026-08-06**.
> Counts below are point-in-time; re-query before trusting them for a decision.
> **Rule: update this file in the same commit that changes an ADR status or finishes an epic.**
> Update `ARCH_SPEC.md` instead when a decision itself changes (new ADR accepted, superseded,
> etc.) — this page tracks *progress*, not *decisions*. The per-file status lines remain
> authoritative; this page is a map, and a map that lies is worse than no map (this project has
> had three stale status tables).

---

## 1. Do next

| What | Kind | Why now |
|---|---|---|
| **Curate the 107 pending skill proposals** (`/skills` → New Skills) | Owner task, no code | **The actual bottleneck.** `reels.skill` is only set for *confirmed* nodes, so the Skill tab stays hidden on most Reels and the Skill Map stays thin. Also the precondition for Guides ever becoming buildable. |
| **Epic 22 — Writing assistance** | Ready to delegate | ADR 0026 accepted + planned; smallest buildable unit on the board |
| **SkillTagger's 101 failures** | Bug, uninvestigated | Last run: 173 processed, 4 matched, 68 proposed, **101 failed**. Unexplained. |
| **Constellation rework** | Owner feedback, needs an ADR 0020 amendment | Dragging does not work; no connections between nodes; owner wants hub-and-spoke with themes as visible root nodes |
| **Actionables content quality** | Prompt work | The action reads as "look at the source", not a real task. Three options recorded in ADR 0019's feedback section. |

## 2. Decided, not built

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

## 5. Process notes learned the hard way

- Check *all remote branches* before picking a new ADR number (two sessions once both wrote 0021).
- Never write an epic plan for an ADR whose input data does not exist yet (ADR 0018's build gate
  is exactly this).
- Artifact flow and the binding architecture rules now live in
  [`ARCH_SPEC.md`](ARCH_SPEC.md) — this page only tracks progress against them.
