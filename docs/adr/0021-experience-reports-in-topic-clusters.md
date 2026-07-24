# ADR 0021 — Experience Reports in Topic Clusters: match-only, primary by construction, unweighted voices

- Status: accepted (grill session 2026-07-24, strong model + user)
- Date: 2026-07-24
- Builds on: ADR 0007 (Experience Reports as their own content type, exempt from ADR 0005),
  ADR 0009 (Match-or-Propose; "one tagger, multiple triggers"), ADR 0012 (Topic-Knowledge-Check),
  ADR 0013 (clustering design, `is_primary`, deliberately coarse scale), ADR 0011/Epic 10
  (Verifier, `caveat`), ADR 0016 (`--caution` reserved for `caveat` + supersession only).
- Unblocks: Epic 11 T11.7, Epic 10 T10.8.

## Context / Problem

ADR 0012 decided that Experience Reports should count toward a Topic Cluster's `confidence`
as independent evidence, and Epic 11 T11.7 additionally called for a narrow "overclaim" flag
on reports. Neither was buildable: **the linkage mechanism was never designed.** Epic 15's
clustering pass (`src/lib/clustering/run.ts`) assigns `topic_cluster_id` + `is_primary` to
`reels` only, `experience_reports` has no cluster column, and nothing associates a report
with a cluster. T11.7 was therefore deliberately deferred when T11.1–T11.6 were built.

Four questions had to be answered: how a report reaches a cluster, when that runs, whether a
report needs an `is_primary` judgment, and how much a report adds to the corroboration count.

## Decision

### 1. Match-only — a report may *join* a cluster, never create one

Reports are matched against existing active clusters using the Match-or-Propose machinery
**with the Propose branch removed**. A report that matches nothing keeps `topic_cluster_id =
NULL`, permanently and correctly.

The full Match-or-Propose pass was the intuitive choice and is wrong here, for three reasons
found by checking the code rather than the plan:

- `src/lib/clustering/prompt.ts:14-15` instructs the model to propose whenever a match is
  doubtful or the candidate list is empty, and `run.ts:112` forces `isPrimary: true` on a
  proposed cluster's first member. A report matching nothing would therefore **spawn a cluster
  whose only member is unsourced, subjective content.**
- Such a cluster then reports `independentCount: 1` → `confidence: "few"`, attaching a
  corroboration reading to a cluster containing **zero sourced material** — destroying at the
  cluster level exactly the trust boundary ADR 0007 created the separate content type to hold.
- This would be the *common* case, not an edge case: clusters are narrow and claim-specific by
  ADR 0013 point 2, while ADR 0007's own examples of reports ("how long I keep a session open",
  "when to use which model") are practice-level — i.e. Skill-Node granularity per ADR 0013
  point 3. Most reports genuinely match no narrow cluster, so the propose path would dominate
  and would also consume the `MAX_CLUSTER_CANDIDATES` budget with report-spawned clusters.

An unmatched report is not a failure: its `skill` tag already places it in the broad Skill-Map
view, which is where practice-level content belongs.

### 2. Bounded triggers: on-save + a daily backstop limited to the active window

Following ADR 0009's "one tagger, multiple triggers", a report is matched on save
(fire-and-forget, as `tagSingle` already does in `src/app/experience/create/route.ts`) and
swept by the daily pipeline as a backstop.

**The sweep must be bounded, unlike the reel sweep.** `runClustering`'s `topic_cluster_id IS
NULL` predicate terminates only because propose always succeeds. Without a propose branch,
unmatched reports stay `NULL` forever and a naive `IS NULL` sweep re-burns an LLM call on
every unmatched report on every run, without bound. Dirty-gating on "new clusters appeared
since last check" does not fix it — new reels create clusters on most daily runs, so the
condition is almost always true.

The bound is the **existing active window**: a report is matchable only while it is within
`CLUSTER_WINDOW_DAYS` of its creation, symmetric with the window that already gates which
clusters are candidates (`run.ts:33-39`). Worst-case per-run cost becomes "reports written in
the last 30 days" — a handful, for a hand-written single-user corpus. No `checked_at` column
is needed; the window self-limits. Reports older than the window freeze as unclustered.

### 3. Primary by construction — no `is_primary` judgment for reports

A linked report always counts as first-hand. ADR 0007 defines this content type *as* lived
experience; `own` and `colleague` are unambiguously the author's own observation. The
echo/restatement question is only meaningful for `curated` (AI-fished) reports, and **there is
no creation path for those today** — `experience/create/route.ts` hardcodes `authorType:
"own"` and nothing else writes reports. Building an echo judgment for an unreachable state is
speculative scope. ADR 0013 point 4 also made `is_primary` deliberately coarse because
`confidence` is a coarse scale, so a rare misclassification barely moves the reading.

**Deferred, not solved:** when `curated` reports gain a real creation path — harvesting
Reddit/comment threads, precisely where restatement is most common — whether they need the
Reel-style echo judgment must be revisited. See `future-todos.md` T7.

### 4. One distinct author = one voice, unweighted

`independentCount` becomes the size of the **union of distinct reel `sources.name` and
distinct report `author_label`** among a cluster's primary members. Five of the owner's own
reports add one voice, not five (they all carry `OWNER_NAME`); a colleague's report later adds
a second. This is exactly symmetric with the reel side — one name, one voice.

**No weighting.** There is a real argument that a hands-on first-hand test outweighs a blog
post, and an opposite argument that n=1 on one person's setup is weaker than independent
replication. Both lose to ADR 0013 point 4: `few/some/strong` is deliberately coarse and
weighting would imply a precision it does not have.

`confidence` is **not** recomputed eagerly on save. `runKnowledgeCheck` already recomputes it
for every active cluster unconditionally on every run (grounded SQL, no LLM), so a link made
on save is absorbed within a day and the design self-heals.

### 5. The overclaim flag is a Verifier concern, not a Knowledge-Check concern

Epic 10's Verifier already implements this: rule (B) Skepticism flags superlatives
("replaces X", "kills X", "best-in-class") into `reels.caveat`. Reports reuse that machinery
with a **report-specific prompt running rule (B) only** — rule (A) Fidelity is meaningless for
a content type that has no source to be faithful to (ADR 0007 / ADR 0005 exemption) — writing
to `experience_reports.caveat` + `caveat_checked_at`, mirroring the reel columns.

ADR 0016 makes this the only compliant option: `--caution` is reserved for "`caveat` +
freshness/supersession notice, and only those", so a separately-named overclaim concept would
have required either a forbidden new color or a misuse of `--caution`.

**Binding prompt constraint:** flag *only* absolute/universal claims. Subjectivity itself must
never be flagged — "I found X annoying", "I prefer Y", "this works for my setup" are the
content type's entire purpose (ADR 0007). Flagging those would break the premise.

Consequently T11.7 splits: the cluster link + corroboration stays **Epic 11 T11.7**; the
overclaim flag becomes **Epic 10 T10.8**.

## Alternatives

- **Full Match-or-Propose for reports** — the intuitive reuse. Rejected: lets subjective
  content create clusters, attaches `confidence` to clusters with no sourced member, and by
  the granularity mismatch would be the dominant path rather than a rare one.
- **Inherit the cluster from the report's `skill` tag (no LLM)** — cheapest. Rejected: skills
  are broad and a skill routinely spans several narrow clusters (ADR 0013 point 3), so there
  is no basis to pick the right one.
- **On-save matching only, single attempt** — cheapest trigger. Rejected: a report written
  days before its topic breaks would permanently miss the cluster, which is exactly the case
  worth catching.
- **Unbounded backstop while unmatched** — rejected: never converges (see decision 2).
- **Counting each report as an independent voice** (T11.7's literal wording) — rejected:
  turns five of one person's reports into five independent sources.
- **Folding the overclaim check into the cluster-match call** — one call, two jobs. Rejected:
  the candidate sets differ fundamentally. Overclaim applies to *every* report; matching only
  touches unmatched reports inside the active window.

## Consequences

- `experience_reports` gains `topic_cluster_id` (FK, nullable), `caveat`, `caveat_checked_at`.
  No `is_primary` column — reports are primary by construction (decision 3).
- A new report-matching module is needed (match-or-null, no propose): the existing
  `clusterOutputSchema` cannot be reused unchanged because it requires the propose branch.
- `computeConfidenceForActiveClusters` extends from a reels-only query to a union over reels
  and reports; every existing `confidence` reading may shift once reports link in.
- Clusters remain guaranteed to originate from sourced content — the ADR 0005/0007 quarantine
  now holds at cluster level, not just row level.
- Two accepted imprecisions, both tied to the same deferred `curated` work: no echo judgment
  for web-harvested reports, and a curated report's `sourceUrl` could double-count a voice
  already counted as a reel `source`. Both unreachable today.
- Trust weighting is explicitly out of scope and parked in `future-todos.md` T7. The
  one-distinct-author-one-voice rule scales into it gracefully — each curator is already a
  distinct `author_label`; only the weighting would be new.
