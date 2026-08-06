# Epic 14 — Source validation & review (parked)

> **Status: PARKED** — noted as an epic at the user's request, to be built "once
> everything else is in place". Needs its own grill + possibly an ADR before
> implementation. Do not build without user go-ahead.

**Goal:** Ensure the curated sources keep working long-term — detect when a source
blocks/breaks (e.g. Reddit 403/429, dead feed URLs, format changes), and respond
sensibly instead of silently producing noise/errors.

**References:** ADR 0001 (curated sources), Epic 1 (ingestion, `sources`,
`disabled` flag), Epic 13 (admin console, `pipeline_runs`), vision backlog V6 (Reddit OAuth).

## Motivation (from operations 2026-07-22/23)
- Reddit feeds return server-side 403/429 (disabled, see `sources.ts` + V6).
- Feed URLs outside of GitHub were never testable from the build sandbox — only the
  first real Railway run showed which ones actually respond.

## Open design questions (to clarify in the grill)
- **Health signal:** what defines "source broken" — N consecutive errors? HTTP status
  pattern? Zero new items over X days despite an active source?
- **Response:** just display/alert, or **auto-disable** past a threshold? Manual
  confirmation? (Consider the collision with the seed-authoritative `enabled` — that
  would need a separate `auto_disabled`/`manual_override` field, see comment in
  `sources.ts`.)
- **Validating new sources:** test once when a source is added (fetch + parse ok?)
  before it goes active.
- **Visibility:** in the admin console (Epic 13 T13.7 source list) — status per source,
  last success, error rate, toggle.
- **Alerting:** notification (mail/push) if an important source fails for an extended time.

## Rough sketch (non-binding)
- Derive health per source from `pipeline_runs` summaries (errors per source over time)
  or a dedicated `source_health` field (`consecutive_failures`, `last_success_at`).
- Admin "Sources" view with status + manual toggle + "revalidate".
- Optional auto-disable past a threshold (conservative, with manual reactivation).

## Deviations/Questions
_(to be filled in only after the grill)_
