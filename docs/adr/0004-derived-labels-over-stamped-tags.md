# ADR 0004 — Derive labels from facts instead of stamping them fixed

- Status: accepted
- Date: 2026-07-21

## Context / Problem

The tool is meant to flag what is "new", "state of the art", or "best practice", and
additionally offer an overview/history page where older items can also be
filtered by relevance/age. If these labels were stamped fixed onto a Reel during
processing, they would be static, inconsistent, and hard to recompute when the
view ("what is SOTA *right now*") changes.

## Decision

Reels store **facts/attributes** (`published_at`, `ingested_at`, `category`,
`maturity`, `relevance_score`, `quality_score`, `experimental`). Display labels such as
"🆕 New", "⭐ State of the Art", "🛠️ Best Practice" are **derived views/filters**
over these facts (e.g. "new" = recent `published_at`; "SOTA" = established + high
relevance, age-independent).

**Exception:** `experimental` is **not** a derivable label, but a stored
flag, since it does not follow from date/relevance.

The attribute set is extensible via a flexible metadata field, without schema migration.

## Alternatives

- **Fixed stamped labels** per Reel: simpler to query, but inflexible; the
  overview/history page would require expensive recomputation or duplicates.

## Consequences

- The overview/history/SOTA page comes "for free" — it is just another query over
  the same data.
- Filter logic lives in one place (the view), not in stored states.
- Requires a flexible metadata field (e.g. JSONB), so new attributes can be
  added without migration.
