# Vision backlog (optional, only after explicit user go-ahead)

Deliberately rough sketches — hold a short grill conversation with the user before
implementation and add an ADR if needed.

## V1 — Topic clustering (content model C)
- Goal: bundle multiple sources on the same topic (activate the reserved
  `reels.topic_cluster_id`).
- Sketch: new table `topic_clusters { id, title, created_at }`. In the daily job, after
  enrichment, one batch call: titles+summaries of the last 7 days → cluster proposals;
  assignment only with high confidence, otherwise null. Feed shows bundled reels as a
  stacked card ("3 sources on this topic").
- Precondition: the feed demonstrably feels repetitive (otherwise don't build).

## V2 — Generated examples (extension of ADR 0005)
- Env flag `ALLOW_GENERATED_EXAMPLES=false` (default). If enabled: if a sourced
  `example` is missing, a second, explicit call may generate an example — display
  mandatorily with a warning label "⚠️ AI-generated, unverified", stored in
  `metadata.generated_example` (never in the `example` field — sourced and generated
  stay separate).
- Precondition: extend ADR 0005 with this addition (status update).

## V3 — Audio mode (TTS)
- "Listen today": turn Top-N summaries into an audio snippet (TTS provider open —
  choose before implementation), player on `/today`. No podcast feed in the first step.

## V4 — Sharing with colleagues / team feed
- Stage 1: read-only access behind a simple shared secret (env `ACCESS_PASSWORD`,
  middleware check, cookie) — no account system.
- Stage 2 (only on real demand): separate profiles/saves per person ⇒ then real
  auth (e.g. Auth.js), own grill session beforehand (changes the data model: user_id columns).
- Privacy note: from stage 1 onward the tool is no longer "private only" — briefly
  check source terms of use.

## V5 — Operational niceties
- Weekly digest email (top of the week) · health alert if the daily job fails 2×
  in a row (simple webhook/mail) · backfill command for new sources
  (`npm run job:backfill -- --source=<name> --days=90`).

## V6 — Reddit via OAuth (TODO, user request)
- Reddit blocks server-side/cloud-IP access to the `.rss` feeds (403/429). That's why
  `reddit-claudeai` and `reddit-localllama` are set to `disabled: true` in `sources.ts`.
- For real access: register a Reddit app (type "script") (client id/secret), obtain a
  client-credentials token, query against `oauth.reddit.com` with a clean user agent and
  rate limits. New fetcher type `reddit_oauth` (secrets as env vars).
- Fits thematically with the **curated experience reports** (theme 1/Epic 9 follow-up:
  tips from comment sections) — tackle together there. Reactivate = remove `disabled`.
