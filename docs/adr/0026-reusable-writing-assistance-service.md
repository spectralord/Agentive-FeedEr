# ADR 0026 — A reusable writing-assistance service for user-authored text

- Status: **accepted** 2026-08-03 (grill session, strong model), **scoped to one consumer** —
  Experience Report authoring, the only surface with a real prose field that ships today. The module
  stays reusable; only the UI wiring is narrowed. All six open questions resolved in "Grill outcome"
  below. Buildable now — see `docs/plan/epic-22-writing-assistance.md`.
  Was: proposed (owner requirement stated 2026-08-01 during the ADR 0018 grill; needs its
  own grill before building)
- Date: 2026-08-01
- Related: ADR 0018 decision 8 (hand-editable guides — the first consumer), ADR 0015 (executor
  seam, **binding**), ADR 0024 (on-demand generation on the subscription — the precedent this
  follows), ADR 0007/Epic 9 (Experience Reports — the second obvious consumer), ADR 0003 (null over
  hallucination), ADR 0005 (sourced-only)

## Context / Problem

Two surfaces in this product take **user-authored prose**: Experience Reports (Epic 9, shipped) and
— once ADR 0018 lands — hand-edited Skill Guides. The owner wants writing assistance when authoring
that content: optional help drafting or improving a passage, available on demand.

Building that inside ADR 0018 would be a mistake. It is not a guide feature; it is a capability that
happens to be *used* by guides first. Folding it in would mean the second consumer either
duplicates it or refactors it out later — and Experience Reports already exist and would want it
today.

There is no precedent to extend: a grep for existing assist/suggest helpers in `src/lib/` returns
nothing, and no table currently stores user-modified generated content. This is genuinely new
surface area, which is the reason it deserves a decision rather than an implementation detail.

## Decision (proposed)

1. **One service, many call sites.** A single module (e.g. `src/lib/writing/`) exposing a small
   interface — take the current text plus an intent, return a suggested revision — consumed by any
   surface with a prose field. No per-surface copies of the prompt or the plumbing.

2. **Assistance is opt-in and toggleable, never automatic.** It runs when the author asks. Nothing
   rewrites what the user typed on its own, and the feature can be switched off entirely. Prose the
   user wrote is theirs by default.

3. **Suggestions are proposals, never silent replacements.** Output is presented for the author to
   accept, reject, or edit. This is the same discipline ADR 0018 decision 8 applies to
   regeneration, for the same reason: silently overwriting human text is the failure mode that makes
   an assistant untrustworthy.

4. **Local-profile only, via the Executor seam** (owner requirement). Runs through the injected
   `Executor`, which under `APP_PROFILE=local` resolves to `claude-code` — the Claude Code
   subscription, not the metered API. Same shape and the same enforced guarantee as ADR 0024:
   `resolveExecutionConfig` throws on `local` + `api`. Same consequence too — the `claude` CLI must
   exist on the app host, so the affordance must be **hidden or disabled** under
   `APP_PROFILE=cloud` rather than failing at runtime.

5. **Sourced-only does not apply the same way here — and that boundary must be explicit.** ADR 0005
   governs *generated content presented as sourced knowledge*. Help phrasing a sentence the user is
   writing about their own experience is a different act. But the line is thin, and blurring it
   would let unsourced LLM prose enter a product whose trust model is sourced-only. So: assistance
   may improve *how* the author says something; it must not invent claims, citations, or facts the
   author did not supply. Any suggestion introducing a factual assertion is out of scope for this
   service.

## Alternatives

- **Fold it into ADR 0018.** Rejected: couples a cross-cutting capability to one feature; Experience
  Reports would then either duplicate it or trigger a refactor.
- **Per-surface bespoke helpers.** Rejected: guarantees prompt drift and duplicated executor
  plumbing across surfaces.
- **Always-on rewriting / autocomplete-style assistance.** Rejected by decision 2 — the owner asked
  for something usable "if the user wants it", and unsolicited rewriting of authored prose is a
  different and much more intrusive product.

## Grill outcome (2026-08-03) — ACCEPTED, scoped to one consumer

Tested against the code. The "two consumers" premise that justified making this cross-cutting is
**half true**, and that resolves most of the open questions by shrinking the decision:

- **Experience Report authoring exists and ships today** — `src/app/experience/new/page.tsx` and
  `.../[id]/edit/page.tsx`, with exactly one prose field: `experience_reports.body` (`text NOT NULL`).
  `title` is a single line and does not want assistance.
- **Guide editing does not exist.** There is **no `skill_guides` table** (0 occurrences in
  `src/db/schema.ts`), and ADR 0018 decision 6 gates that build on a corpus the nodes do not yet
  have. It is a hypothetical consumer, not a second one.

**Decision: accept decisions 1–5, but build for the one real surface first.** The module stays
shaped for reuse (that costs nothing and is decision 1's whole point), and the *UI* is wired only
into Experience Report authoring. Wiring the guide editor is a later, additive step when Guides
exist — not a reason to design two affordances now.

This deliberately does **not** repeat ADR 0025's outcome, and the difference is worth naming: 0025
had **zero** live consumers and duplicated an existing table, so its substrate had nothing to stand
on. 0026 has one shipped surface with a real prose field, so the narrow build is justified on its
own merits even if Guides never land.

### Open questions, resolved by that scoping

1. **Intents → two, not a menu.** "Improve this" and "make it shorter". Both are unambiguous on a
   free-prose experience report, and neither needs the author to learn a vocabulary. "Continue
   writing" is rejected for now: it drifts toward composing *for* the author, which decision 2's
   opt-in framing is specifically avoiding.
2. **UI → one affordance below the textarea**, not a toolbar and not inline decoration. The form is
   already a plain stacked form on a phone-first layout; a toolbar would be the most intrusive
   option available and the least consistent with the rest of the app.
3. **Persistence → never persisted before acceptance.** A suggestion lives in component state only.
   Navigating away loses it, which is the simplest correct behaviour and sidesteps any interaction
   with ADR 0018's layered edits (which do not exist yet anyway).
4. **Context → the field's own text only.** No node content, no tagged Reels, no source material.
   This keeps the prompt small *and* keeps decision 5's sourced-only boundary trivially true: the
   service never sees source material, so it cannot leak an unsourced claim from one.
5. **ADR 0018's "flag when better content exists" → not this service's job.** Confirmed as the guide
   pipeline's concern; it compares stored generated text against a stored manual edit, neither of
   which this service touches. Removed from scope.
6. **Zod shape → `{ revised: string }`, validation deliberately thin.** ADR 0015 mandates
   schema-validated output; for free prose that honestly means "a non-empty string". Adding a
   rationale field was considered and rejected — it would be unverifiable prose validating
   unverifiable prose. The thinness is recorded here so a future reader does not mistake it for an
   oversight.

## Open questions — answered above by the 2026-08-03 grill; kept for the record

1. **What intents does it support?** "Improve this", "make it shorter", "fix grammar", "expand this
   bullet", "continue writing"? Each is a prompt and a UI affordance. A minimal set beats a menu
   nobody uses — but which minimal set?
2. **Where does assistance appear in the UI, on a phone-first product?** Experience Report authoring
   is a form; guide editing is a text area inside a hub page. Inline affordance, a toolbar, or a
   sheet? This is a design-doc question as much as an architecture one.
3. **Is a suggestion ever persisted before acceptance?** Decision 3 says suggestions are proposals;
   if the user navigates away mid-suggestion, is it lost (simplest) or held (needs storage, and
   interacts with ADR 0018's layered edits)?
4. **Does it need the surrounding context?** Improving one paragraph of a guide may need the whole
   guide, or the node's tagged Reels, to stay coherent. That materially changes prompt size and
   cost, and touches sourced-only (decision 5) if the context includes source material.
5. **Interaction with ADR 0018's "flag when better content exists".** ADR 0018 decision 8 wants a
   manual edit flagged when newer generated content supersedes it. Is that signal this service's
   job, or the guide pipeline's? It smells like the pipeline's, but the two meet here.
6. **Zod-validated output of what shape?** ADR 0015 mandates schema-validated output. Free prose is
   awkward to validate meaningfully beyond "is a non-empty string" — is there a useful structure
   (e.g. revised text + a one-line rationale), or is this the case where validation is thin by
   nature?

## Consequences (if built)

- New executor-backed module + prompt(s) + zod schema + unit tests with a mocked caller (ADR 0015).
- A shared UI affordance used by at least two surfaces, plus the cloud-profile guard from decision 4
  (pinned by a test, per ADR 0024's precedent).
- No new runtime dependencies expected.
- `CONTEXT.en.md` gains a glossary entry so "writing assistance" does not drift into meaning
  Write-up, Guide, or Deep-Dive — four adjacent generation concepts is already a lot to keep
  straight.
