# ADR 0005 — Sourced-only content (no invented examples/actions)

- Status: accepted
- Date: 2026-07-21

## Context / Problem

The core purpose of the tool is "how do I use AI *correctly*". A hallucinated
code example or an invented recommended action is thus worse than none at all
— it actively teaches false practice and destroys the trust that is the only currency
of a personal curation tool.

## Decision

Examples (`example`) and action lines (`action`) in a Reel may **only** show
what is substantiated in the source. If nothing is substantiated, the field stays
`null` — nothing is generated. The effort tag is exempt from this: it is an
estimate, not a claim requiring substantiation.

## Alternatives

- **LLM-generated examples/actions** (clearly marked "AI-generated, unverified"):
  better coverage, but hallucination risk. Deliberately deferred as a later, optional
  extension, not in the MVP.
- **Hybrid** (prefer sourced, otherwise generated): likewise possible later.

## Consequences

- Some Reels have no example/no Action — accepted in favor of credibility.
- Technically presupposes the null-instead-of-guessing behavior from ADR 0003.
- Every Reel retains a source link for verifiability.
