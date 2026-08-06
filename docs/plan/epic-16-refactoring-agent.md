# Epic 16 — Refactoring agent (nightly Claude Code cron, parked)

> **Status: PARKED** — noted as an epic at the user's request. Needs its own grill
> (+ possibly an ADR) before implementation. Do not build without user go-ahead.
> Related to T4 (design expert session) and **T6** (execution via Claude Code
> routines — shared scheduling/quota mechanics).

**Goal:** A recurring agent (analogous to the design expert session, but **as a
Claude Code cron/routine**) that **goes through the repo at night**, finds
opportunities for improvement, and delivers **concrete suggestions** — refactoring,
simplification, test gaps, dead code, inconsistencies with ADRs/conventions —
without introducing any risk of its own.

> **Update 2026-08-03 — ADR 0025 (generic task queue) was REJECTED.** The grill found:
> there is exactly *one* candidate consumer for such a queue, namely this epic — and
> `pipeline_runs` already covers status lifecycle, both timestamps, `summary` (jsonb),
> and `error`. If Epic 16 gets built, it therefore gets **its own trigger** (same shape
> as `beginRun`/`runAndFinish` in the daily job), not a generic handler registry. Only a
> *second* real async use case would reopen the queue question.

**References:** CLAUDE.md ("design process" review minimum checklist), `future-todos.md` T4
(expert session pattern), Epic 16 shares CC routine mechanics with `future-todos.md` T6.
Uses Claude Code **quota** instead of API tokens (like T6).

## Motivation
- Code grows across many epics/subagents; nobody regularly looks at quality holistically.
- Nighttime is idle anyway — a quota-based routine run costs no API money.
- Fits the established pattern of "expert agent with a clear mindset" (like design/persona).

## Open design questions (to clarify in the grill)
- **Output form:** just a **report/"findings list"** (human decides), or directly a
  **draft PR** with small, safe changes? (Conservative: suggestions/draft PR, merge
  stays with the human — nothing gets pushed to `main` unilaterally at night.)
- **Scope per run:** whole repo vs. **rotating slice** (context/cost limits) —
  e.g. a different module/directory each night.
- **What counts as "improvement":** refactoring/duplicates, simplification, test
  coverage, ADR/convention compliance (CLAUDE.md), dead code, obvious perf/cost. **No**
  feature scope, no large rewrites without approval.
- **Non-regression (hard):** the agent must **not break anything** — suggestions must
  leave build + tests green; auto-created branches only go through CI/review afterward.
- **Cadence + cost:** nightly routine; quota usage (shares infrastructure with T6);
  guardrails against scope creep / endless refactoring.
- **Interplay with the review process:** findings land as a prioritized list that the
  strong model (or the user) triages — no parallel "second channel of truth".

## Rough sketch (non-binding)
- **Claude Code routine (nightly)** → agent reads the repo (or a rotating slice) + CLAUDE.md/
  ADRs → produces a **prioritized refactoring report** (`docs/…` or issue) + optionally
  a **branch with small, safe improvements** as a draft PR → normal review/merge.
- Guardrails: hard size limits per suggestion, "green only", no ADR violation, no feature scope.

## Deviations/Questions
_(to be filled in only after the grill)_
