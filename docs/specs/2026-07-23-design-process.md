# Design process — draft to be grilled (2026-07-23)

> **Purpose:** make our so-far *organically grown* working/design process explicit,
> name the gaps, and jointly grill how to shape it deliberately. Based on the
> already agreed-upon building blocks (CLAUDE.md) and the parked ideas (`future-todos.md` T4/T5).
> The grill's outcome will be recorded in CLAUDE.md (conventions) or an ADR.

---

## 1. Current state (observed, what we actually do)

**Design/decision loop:**
1. **Grill** (grill-with-docs): the strong model (Opus) interviews one question at a
   time, grounded in code + glossary + prior ADRs.
2. **Record**: decisions land as (a) a glossary term in `CONTEXT.md`,
   (b) an **ADR** in `docs/adr/`, (c) a task plan in the epic file `docs/plan/epic-*.md`.
3. **Build**: implementation is delegated to **subagents (Sonnet)** — one epic file each,
   on its **own feature branch** (`claude/epic-<N>-<short>`), frequent commits.
4. **Review**: the strong model checks (build/tests green, verification satisfied, no
   ADR violation) **before** merging.
5. **Merge → deploy**: feature branch into `main`, Railway deploys `main`.

**Already agreed rules (CLAUDE.md):** model division of labor, branch strategy,
frequent subagent commits, language (UI/docs German, code/commits English).

## 2. Strengths (keep)

- One-question-at-a-time grilling forces real decisions instead of fake consensus.
- Durable records (ADR/glossary/epic) → context survives context compaction & sessions.
- Delegating to a weaker model saves cost; review maintains quality.
- Branch isolation allows parallel epics without collisions.

## 3. Gaps / open questions (grill candidates)

- **L1 — ADR threshold:** when does something deserve an ADR vs. just an epic note vs. just a
  glossary entry? (Currently by gut feel.) Clear triggers are missing.
- **L2 — Grilling vs. building directly:** which changes need a design grill, and which are
  mechanical enough for direct delegation? (A lower bound for "design-worthy".)
- **L3 — UI/UX design has *no* process.** So far purely functional/"thin" (the user's own
  assessment). Where in the lifecycle does a deliberate UX/gamification pass go? As its own
  **design expert session** (T4) with a handoff prompt? When/how often?
- **L4 — Content/value assessment (T5):** should a **persona agent** evaluate the *generated
  content* from a developer's perspective (a feedback loop on product quality, not the
  code)? Where does that dock in?
- **L5 — Review depth:** how rigorously does the strong model check subagent results? A fixed
  checklist scope vs. situational?
- **L6 — "Designed enough to build":** how do we recognize that a grill is *done* and moves
  into a plan? (Exit criterion.)
- **L7 — Degree of parallelism:** how many epics/subagents at once, and how do we keep the
  overview (task board, status table) up to date?

## 4. Three levels of the design process (target picture)

Each level needs a **trigger** (when), an **owner** (who), an **artifact** (what remains):

| Level | Trigger | Owner | Artifact |
|---|---|---|---|
| **Product/architecture design** | genuine fork in the road / data model change | strong model (Opus), grill | ADR + epic plan + glossary |
| **UX/gamification design** | new user-facing epic *or* periodic holistic pass | **design expert session** (T4) | UX spec / design ADR + buildable UI tasks |
| **Content quality** | periodic, sampling generated reels | **persona agent** (T5, future music) | assessment → feeds into enrichment prompt/threshold |

Today only the first level is developed.

## 5. The strong model's proposal per open question (to be confirmed/overturned in the grill)

> These are **my recommendations**, not decisions already made — the user confirms
> or overturns them in the grill. Only then do they move into CLAUDE.md or an ADR.

- **L1 — ADR threshold → proposal:** an ADR when a decision (a) is hard to reverse
  or shapes structure/data model, (b) *rejects* a plausible alternative that's worth
  remembering, or (c) is referenced by later work. Otherwise a glossary entry (new
  term) or an epic note (local detail) is enough. Rule of thumb: *"would a future me/a
  subagent get this wrong without knowing the why?"* → ADR.
- **L2 — Grilling vs. building directly → proposal:** grill on a genuine fork with
  trade-offs, unclear intent, or cross-cutting effects. Delegate directly for
  mechanical/clearly specified tasks. Litmus test: *"can I write the epic tasks
  unambiguously without making a decision?"* yes → build, no → grill.
- **L3 — UX design process → proposal:** a dedicated **UX/gamification pass** as a
  distinct phase, triggered (a) *before* building any user-facing epic with new screens/
  interactions and (b) once now as a **holistic review** (because UX is currently thin).
  Owner: the parked **T4 design expert session** (Opus/design agent, comprehensive handoff
  prompt, gamification + good-UX mindset). Artifact: UX spec/design ADR + concrete,
  buildable UI tasks.
- **L4 — Persona loop (T5) → proposal:** leave it as future music, but define the
  docking point: a persona agent periodically samples generated reels, assesses
  developer value; the result feeds into enrichment-prompt/`QUALITY_THRESHOLD` tuning.
  Not built now.
- **L5 — Review depth → proposal:** a fixed **minimum checklist** (build green, tests
  green, task verifications run, no ADR violation, no new libs, diff limited to the
  epic) **plus** situationally deeper for architecturally significant changes.
- **L6 — "Designed enough" → proposal:** exit criterion = every branch of the decision
  tree is *resolved or deliberately deferred with a note*; epic tasks can be written
  unambiguously with verification steps; no "TBD" in the critical path.
- **L7 — Degree of parallelism → proposal:** limit concurrent subagents to what the
  strong model can review well (~2–3), each on its own branch; **task board + README
  status table** as the single source of truth, updated at every epic boundary.

## 6. Grill protocol (self-grill by the strong model, 2026-07-23 — user override open)

> Since autonomous continued work was desired and CLAUDE.md gives the strong model design
> authority, these questions were decided in a **self-grill** (both sides played out).
> Everything recorded in ADR 0014 + CLAUDE.md. The user can overturn any point.

- **Q1 — Scope → DECIDED: A, with B "carried along".** The cheap engineering rules
  (L1/L2/L5/L6/L7) apply immediately (no downside), the focus of *active* work is the
  **UX level (L3)**. Counter-check: B-first would be cheaper, but doesn't close the
  biggest product gap; "everything integrated" (C) too slow. → A sequenced beats both.
- **L1 ADR threshold → DECIDED** (see CLAUDE.md): hard to reverse / structural / rejected
  alternative / referenced later ⇒ ADR; otherwise glossary/epic note.
- **L2 Grilling-vs-building → DECIDED:** grill on a genuine fork; otherwise delegate
  directly if epic tasks can be written unambiguously without a decision.
- **L3 UX process → DECIDED:** its own UX/gamification pass (before user-facing epics +
  once now holistically) via a **design expert session**; handoff prompt lives at
  `docs/specs/design-expert-handoff-prompt.md`.
- **L4 Persona loop → DECIDED:** parked (future music), docking point documented.
- **L5 Review depth → DECIDED:** fixed minimum checklist + situationally deeper.
- **L6 "designed enough" → DECIDED:** every branch resolved/deferred, tasks writable
  unambiguously, no "TBD" in the critical path.
- **L7 Parallelism → DECIDED:** ~2–3 subagents, task board + status table as the source of truth.

**Next concrete step (for the user to take, if desired):** start the design expert session
with the handoff prompt → its UX proposals come back as a review before anything gets built.
