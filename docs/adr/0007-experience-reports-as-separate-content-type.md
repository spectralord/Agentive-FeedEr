# ADR 0007 — Experience reports as a separate content type

- Status: accepted
- Date: 2026-07-22

## Context / Problem

There should be an area for subjective experience/practice reports ("how long to
keep a session open", "when to use which model", tricks) — deliberately *not
necessarily validated*, meant to prompt reflection, partly self/company-authored, partly
later curated from sources (Reddit/comment sections). This is in direct tension with ADR 0005
(sourced-only): the Reel feed prohibits unsubstantiated content, because trust is the
currency. Mixing both into the same `reels` table would blur this trust
boundary.

## Decision

Experience reports become their **own content type** (`experience_reports`), separate from
`reels`:
- They are **not** subject to ADR 0005 — subjective/unvalidated is allowed and clearly
  marked as such.
- Instead of a `source`, they carry an **author**: `author_type` (`own` | `curated`,
  later `colleague`) + `author_label`. In the MVP this substitutes for
  real authentication; real multi-user login is an end-of-road feature.
- A relevance score is only AI-assigned for `curated` reports (meaning "broadly
  useful / thought-provoking"); own reports remain neutral (not
  down-ranked), optionally with AI self-feedback on request.
- Shared concepts (skill reference, `outdated` marking) are given to the type via its own
  fields — without inheriting the Reel rules.

## Alternatives

- **A flag on the Reel** (`is_experience`): simpler in the schema, but mixes two
  incompatible content contracts (sourced vs. subjective) into one table and one
  UI logic. Rejected.

## Consequences

- Clean quarantine: in the data model *and* visually always clearly "lived
  experience, not verified news".
- The seam for later real sharing (`author_label` → `user_id`) exists from the start.
- Two content types mean somewhat more query/UI surface; accepted.
