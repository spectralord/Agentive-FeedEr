-- Re-queue raw_items that are marked enriched but produced no Reel.
--
-- Why this exists: on 2026-08-02, 135 ingested items were deliberately marked
-- `enriched_at = now()` WITHOUT being enriched, to steer a bounded enrichment run
-- onto Claude/agentic-relevant items first (the enrichment queue is oldest-first,
-- so a small MAX_ENRICH_PER_RUN would otherwise have burned quota on the stalest
-- corporate AI news). Those items are recoverable: a genuinely enriched item
-- always has a `reels` row, so "enriched_at set AND no reel" identifies exactly
-- the skipped ones.
--
-- Also clears `enrich_error` so items that failed a previous run get another
-- attempt (per-item failures never abort a run — see docs/plan/README.md §2).
--
-- NOT destructive: touches only the two queue-control columns, never content.
--
-- Usage:
--   docker compose exec -T db psql -U feedr -d feedr_dev -v ON_ERROR_STOP=1 \
--     < scripts/requeue-unenriched.sql
--
-- Then enrich a bounded batch (manual trigger, Claude Code quota, no API spend):
--   MAX_ENRICH_PER_RUN=10 npm run job:cc
-- or press "Enrichment only" in /admin.

BEGIN;

UPDATE raw_items ri
SET enriched_at = NULL,
    enrich_error = NULL
WHERE ri.enriched_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM reels r WHERE r.raw_item_id = ri.id);

COMMIT;

SELECT count(*) AS queued_for_enrichment
FROM raw_items
WHERE enriched_at IS NULL AND enrich_error IS NULL;
