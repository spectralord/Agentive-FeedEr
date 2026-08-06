# Experience reports & quality extensions — design

- Date: 2026-07-22
- Status: for review / basis for implementation (Epics 9–12)
- Related: `docs/specs/2026-07-21-agentive-feeder-design.md`, ADRs 0007–0009, `CONTEXT.md`

The grill session on 2026-07-22 produced **four** named design themes.
Only theme 1 has been fully grilled; 2–4 are deliberately sketched and will each be
grilled individually before implementation.

---

## Theme 1 — Experience section (Epic 9)

### Purpose
A place for subjective, lived experience ("how long a session stays open", "when to
use which model", tricks) — not necessarily validated, meant to spark thought, extensible
as **company knowledge** by colleagues. Deliberately **outside** ADR 0005 (sourced-only),
cleanly separated from the verified reel feed (ADR 0007).

### Data model (`experience_reports`)
- `id`, `title`, `body` (Markdown), `created_at`, `updated_at`
- `author_type`: `own` | `curated` (later `colleague`)
- `author_label`: name (own) / source handle (curated)
- `relevance_score` (nullable): AI-assigned, only for `curated`; meaning "broadly useful /
  thought-provoking", not "fits my profile"
- `skill` (nullable): canonical skill slug — **not set by the user**, set by the
  SkillTagger (theme 4)
- `lifecycle_state` (`active`|`deprecated`|`archived`), `lifecycle_reason` (nullable), `superseded_by` (nullable → report/reel)
- `source_url` (nullable): only for `curated`
- `metadata JSONB`

### Relevance score (grill result)
- **Own reports:** shown neutrally, **not** down-ranked. Optionally the user can
  *actively* request an AI assessment as **self-feedback** (not a filter).
- **Curated reports:** AI-scored for ranking (expansion path A→C: first an AI score,
  later "helpful" votes, once there are multiple users).

### Durability (ADR 0008)
Own reports belong to the **durable knowledge layer** — they don't rotate out
automatically, but can be manually moved via `lifecycle_state` (`active → deprecated →
archived`, with a reason/`superseded_by`). **No auto-delete**; everything stays
historically traceable (ADR 0008). Hard deletion only as a rare manual emergency exit.

### Skill link & actionables
- Reports carry the same optional `skill` link as reels ⇒ show up on skill nodes
  **labeled** (not as their own category) alongside reels.
- **Actionables** ("to-try") are derived from reels *and* reports — the checkable
  progress unit. Reels/reports themselves are **never** checked off. (The actionable
  concept spans themes, feeds into Epic 6/7 — see "Revised assumptions".)

### MVP cut (Epic 9)
**In scope:** entity + migration · capture/edit own/company reports (form:
title, Markdown, optional "⭐ important") · display page, filterable by `author_type` ·
lifecycle actions (`deprecated`/`archived`/reactivate) with a reason + optional `superseded_by`.
**Not in scope (follow-up themes):** curated reports + scraping (Reddit/comments) ·
AI self-feedback · skill tagging (theme 4) · actionables (own theme, feeds into Epic 7).

---

## Theme 2 — Content verifier (Epic 10, Vision)

A critical AI step that fact-checks content **of any origin** and flags dubious
statements with `caveat` (reels *and* reports). Especially valuable for
unvalidated experience reports. Touches the enrichment path and pushes against ADR 0003
(single pass) → own grill + own ADR before implementation. Sketch: an additional
`caveat` field/step, shown as a warning note on the card.

---

## Theme 3 — SOTA freshness re-check (Epic 11, Vision)

`isSota` is deliberately age-independent (Epic 5), so outdated entries can stay stuck as
"state of the art". A periodic job re-evaluates current SOTA entries against
newer ones and sets outdated ones to `lifecycle_state = deprecated` (`superseded_by` — the
same mechanism as for reports, ADR 0008) or downgrades `maturity`. Fits the daily-job
pattern. Own grill before implementation (criteria for "still SOTA?").

---

## Theme 4 — SkillTagger (Epic 12) — see ADR 0009

**Match-or-propose** assigns content to canonical skill nodes:
- Match against an existing node → automatic, in the background.
- No match → *propose* a new node, only created with user confirmation.
- As long as the taxonomy fits in the prompt: pure LLM assignment; embeddings later.
- **One tagger, multiple triggers:** reels in the daily job (batch); manual reports on-save
  (single item); the daily run as a backstop for anything still untagged.
- Going forward, enrichment only supplies a **raw skill guess**; the SkillTagger
  reconciles it against the controlled vocabulary (revises ADR 0003).

The SkillTagger is a **precondition** for the skill map (Epic 7) and for the skill link
of the experience section.

---

## Revised assumptions in existing epics

This grill session changes assumptions in epics that are **not yet built** (6/7). The
changes are recorded here; the affected epic files reference this document.

- **Actionable/to-try as the progress unit:** it's not reels/reports that get checked off,
  but actionables derived from them. The skill node advances via completed actionables.
  → affects Epic 6 ("tried" interaction) and Epic 7 (progress logic).
- **A skill node additionally has a self-status** ("I know this" / "already tried"):
  someone who already has the knowledge doesn't need to complete actionables. Self-declaration
  **and** actionable evidence exist side by side. → Epic 7.
- **Skill assignment comes from the SkillTagger** (Epic 12), not from the enrichment pass and
  not from the user. → Epic 7 (node aggregation T7.2 is replaced/extended by Epic 12).

---

## Order / dependencies
- **Epic 9** (experience section MVP) is independently buildable (without skill tagging/actionables).
- **Epic 12** (SkillTagger) should come **before** Epic 7 (skill map) and unlocks the
  skill link for Epic 9.
- **Epic 10/11** (verifier, SOTA re-check) are independent vision extensions.
- All of 9–12: build only after explicit user go-ahead or their own grill (10/11).
