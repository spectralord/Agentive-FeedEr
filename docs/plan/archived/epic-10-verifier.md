# Epic 10 — Content verifier (two-stage)

**Goal:** Critically fact-check content — reliable (grounded), without the verifier
itself hallucinating. Two stages: **reel verifier** (fidelity + skepticism → `caveat`)
and **cluster corroboration** (`confidence` from independent sources).

**References:** ADR 0011 (two-stage, core), ADR 0003 (single pass — revised),
ADR 0004 (separated facts/views), ADR 0007 (experience reports), ADR 0008 (layers).
Glossary: Verifier, caveat, confidence, corroboration.

> **MVP = stage 1 (reel verifier).** Stage 2 (corroboration/`confidence`) needs
> **clustering** (`topic_cluster` / content model C / Vision V1) and comes after that.
> External web corroboration is an even later, separately decided extension
> (touches ADR 0001). User go-ahead needed before building.

---

## Stage 1 — Reel verifier (MVP)

### ☑ T10.1 — Schema: `caveat` on `reels`
- `reels.caveat text` (nullable). Migration. **Verification:** migration green; field
  defaults to `null`.
- Implemented: `reels.caveat` (text, nullable) + `reels.caveat_checked_at` (timestamp,
  nullable) — a second column is needed because `caveat` itself is `null` both before and
  after a legitimate "no caveat found" run (see Deviations below,
  same pattern as `topic_clusters.knowledge_checked_at`, Epic 11). Migration
  `drizzle/0009_moaning_mongu.sql`.

### ☑ T10.2 — Critic pass (`src/lib/verifier/run.ts`)
- Own LLM call (injectable `StructuredCaller` like enrichment/SkillTagger),
  model configurable (default Haiku). Input: **source (`raw_item`) + finished reel**
  (summary/example/action). Output (JSON schema, zod-validated):
  `{ caveat: string | null }` — `null` if there's nothing to flag (the normal case).
- **Check rules in the prompt (binding):**
  - **Fidelity (A):** does the summary/example/action claim more than the source
    supports? If so, a brief caveat ("Summary overstates: source says X, not Y").
  - **Skepticism (B):** flag risky claim types (unsupported benchmarks/numbers,
    superlatives/"replaces/kills X", overgeneralizing from a single case).
  - No external fact-checking, no inventing. When in doubt, `null`.
- **Gated:** only process reels that are actually displayed (quality_score ≥ QUALITY_THRESHOLD
  or relevance-relevant) and that haven't had a verifier run yet.
- **Verification:** unit tests with a mocked caller: overstatement → caveat; faithful reel → null.

### ☑ T10.3 — Hook into the pipeline
- As its **own step after enrichment** (pattern like SkillTagger, ADR 0011/0009),
  idempotent ("only reels without a verifier run"). Hooked into `src/lib/pipeline.ts` so
  that cron **and** the admin button both run it. Verifier errors don't abort the run.
- **Verification:** integration test: new reel → after the run, `caveat` is set or `null`;
  second run processes 0.

### ☑ T10.4 — Display + filter
- `ReelCard`: if `caveat` is set, show a ⚠️ notice (subtle, not alarmist),
  **separate** from the scores.
- Feed/overview filter: optional toggle "hide/show items with a caveat" (default:
  show — transparency). `caveat` does **not** flow into `quality_score` (ADR 0004).
- **Verification:** curl — a reel with a caveat shows ⚠️; toggle hides/shows it; scores unchanged.

### ☐ T10.8 — Overclaim flag for Experience Reports (grilled 2026-07-24 → **ADR 0021**)

> **Moved here from Epic 11 T11.7 and from the stale T10.6 placeholder.** ADR 0021 decision 5:
> the overclaim flag is a *Verifier* concern, and it needs **no clustering at all** — hence
> Stage 1, not Stage 2. Read ADR 0021 before building.

- **Schema:** add `caveat` (text, nullable) + `caveatCheckedAt` (timestamptz, nullable) to
  `experienceReports`, mirroring the reel columns exactly (same reason for the second column:
  `caveat` is null both before the check and after a clean result).
- **Critic pass:** reuse `src/lib/verifier/` with a **report-specific prompt running rule (B)
  Skepticism only**. Rule (A) Fidelity must be dropped — a report has no source to be faithful
  to (ADR 0007 / ADR 0005 exemption), so there is nothing to compare against. Injectable
  `StructuredCaller`, same `{ caveat: string | null }` output shape.
- **BINDING prompt constraint (ADR 0021 decision 5):** flag **only** absolute/universal claims
  ("replaces X completely", "nobody should use Y anymore"). **Never** flag subjectivity itself —
  "I found X annoying", "I prefer Y", "this works for my setup" are the content type's entire
  purpose. Flagging those breaks ADR 0007's premise. Unit-test both directions explicitly.
- **Sweep:** `caveat_checked_at IS NULL`, all reports, no window bound needed — unlike T11.7c's
  matching sweep this converges on its own, because the result does not depend on other data
  appearing later. Own step in `runPipelinePhases` (try/catch-guarded), own `PipelineSummary`
  key — **and add it to `runSummary()` in `src/app/admin/page.tsx`**, which has repeatedly been
  missed when new phases land.
- **Display:** ⚠️ notice on the report, mirroring the reel treatment (subtle, non-alarmist,
  separate from any score). ADR 0016 reserves `--caution` for exactly `caveat` + supersession,
  so use that language and no other. **No filter toggle** — reports are few and hand-written,
  unlike the reel feed; revisit only if volume grows.
- **Verification:** unit tests with a mocked caller (absolute claim → caveat; ordinary
  subjective statement → `null`); integration test (rerun processes 0); curl — report with a
  caveat shows ⚠️.

---

## Stage 2 — Cluster corroboration

> **Moved:** stage 2 has been folded into **Epic 11 (topic knowledge check)** (ADR 0012),
> together with freshness/supersession, because both need the same cluster machinery.
> Precondition: Epic 15 (topic clustering). The following tasks remain as reference.

### ☐ T10.5 — `confidence` from the own corpus (sketch)
- Once `topic_cluster` exists: per cluster, count the number of **independent
  sources** supporting the same claim → `confidence` (e.g. 0–100 or few/some/strong). Show
  it at the knowledge/cluster level (not on individual reels).
- Design details (what counts as "independent/supporting"?) in a dedicated grill before building.

### ✅ T10.6 — Experience reports (later) → **resolved by ADR 0021, split up**
- ~~Stage-2 corroboration + a **narrow overclaim flag** (absolute claims only), never
  subjectivity itself (ADR 0007). Comes with clustering.~~
- **Grilled 2026-07-24 (ADR 0021).** This placeholder bundled two concerns that belong
  apart — and the assumption "comes with clustering" only held for half of it:
  - **Corroboration** (a report counting toward `confidence`) needs clustering →
    **Epic 11 T11.7** (a–e), match-only, primary by construction, one author = one vote.
  - **Overclaim flag** needs **no** clustering — a pure critic pass per report →
    **T10.8 above (stage 1)**.
- Nothing left to build here; the work lives in T10.8 and T11.7.

### ☐ T10.7 — External web corroboration (even later, its own decision)
- Active web search for supporting sources; sources found this way extend the corpus.
  Touches ADR 0001 → own ADR/grill before building.

---

## Completion criteria (stage-1 MVP)
- Reels get a `caveat` (or `null`) during the pipeline run; ⚠️ visible + filterable,
  separate from the scores; critic pass gated + idempotent; build + tests green.
- **Status: met.** T10.1–T10.4 built & tested (281 tests green, 16 of them new
  for this epic). `caveat` shown in `ReelCardBody` as a subtle ⚠️ notice (its own line,
  separate from the confidence badge and R/Q footer), the feed (`FilterBar`) and overview
  filter (`OverviewFilterBar`) each have a "hide/show caveats" toggle (default: show,
  URL param `caveat=0` hides them — same pattern as `experimental`). No effect
  on `quality_score` (ADR 0004) — curl-verified against `npm run start`.

## Deviations/Questions
_(to be maintained by the executing model)_

- **Idempotency marker (T10.1/T10.2):** a second column `reels.caveat_checked_at`
  (timestamp, nullable) instead of misusing `caveat` itself as the marker — `caveat`
  is just as `null` after a legitimate "no caveat" result as it is before the
  first run. Same pattern as `topic_clusters.knowledge_checked_at` (Epic 11).
- **Model configuration (T10.2):** no new env var. `checkReel`/`runVerifier`
  use `callStructured`'s own `ANTHROPIC_MODEL` default (no `model` override
  passed) — same precedent as SkillTagger/clustering, which also have no
  dedicated override. The epic text says "default Haiku, configurable",
  but names no concrete var name; since `ANTHROPIC_MODEL` already defaults to Haiku,
  the most conservative interpretation is to not introduce an additional var (in
  contrast to `KNOWLEDGE_CHECK_MODEL`, which had its own justification).
