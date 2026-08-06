# ADR 0014 — Design process on three levels (product, UX, content)

- Status: accepted (grilled/decided by the strong model; user override possible at any time)
- Date: 2026-07-23
- Basis: `docs/specs/2026-07-23-design-process.md`; CLAUDE.md (model division of labor,
  branch strategy); `future-todos.md` T4 (design expert session) / T5 (persona agent).

## Context / Problem

Our working/design process grew organically: grill → ADR/glossary/epic → delegation
to subagents → review → merge/deploy. The **product/architecture level** works, but
(a) explicit thresholds were missing (when to write an ADR? when to grill? when is something
"fully designed"?), and (b) two levels were missing entirely: **UX/gamification design**
(so far "thin") and a **content quality assessment** of the generated Reels.

## Decision

The design process is now run **explicitly on three levels**, each with *trigger, owner,
artifact* (details/rules in CLAUDE.md → "design process"):

1. **Product/architecture design** — strong model, grill/self-grill → ADR + epic + glossary.
2. **UX/gamification design** — its own pass before user-facing epics and as a periodic
   holistic review; carried out by a **design expert session** with a fixed
   **handoff prompt** (`docs/specs/design-expert-handoff-prompt.md`).
3. **Content quality** — periodic **persona agent** (deliberately future work), whose
   assessment feeds back into the enrichment prompt/`QUALITY_THRESHOLD`.

Additionally, the **working rules** are codified: ADR threshold, grill-vs-build-directly,
exit criterion "designed enough", minimum review checklist, degree of parallelism (~2–3 subagents).

**Sequencing:** the cheap engineering rules apply immediately (no downside); the first
*active* new work is the **UX holistic pass** (biggest lever on core value), for which the
handoff prompt is the next deliverable. Level 3 stays parked.

## Alternatives

- **Formalize only the engineering workflow** (sharpen level 1, ignore UX/content): leaves the
  biggest product weakness (UX) unaddressed. Rejected — we keep the cheap rules,
  but the focus is on the missing UX level.
- **Build everything integrated right away** (all three levels sharp at once): too big/slow
  before the first usable result. Rejected in favor of sequencing.
- **Do UX inline within each respective epic** (no dedicated pass): reproduces the previous
  "thin" state, because UX then always yields to functional pressure. Rejected — dedicated
  pass with its own owner/artifact.

## Consequences

- CLAUDE.md gets a "design process" section with levels + working rules.
- New deliverable: `docs/specs/design-expert-handoff-prompt.md` (handoff prompt for the
  UX expert session, gamification + good-UX mindset).
- User-facing epics (e.g. 6, 7, 8) will get a UX-pass check before being built, going forward.
- The decision is a **self-grill decision of the strong model**; the user can
  overturn individual points in the next exchange, in which case this ADR is revised.
