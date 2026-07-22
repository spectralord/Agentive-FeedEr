-- Dev/verification seed data (NOT used in production). Reproducible test reels
-- with varied published_at, ingested_at and scores so feed / Top-N / overview
-- views can be verified by hand. Safe to run repeatedly.
TRUNCATE reels, raw_items, sources RESTART IDENTITY CASCADE;

INSERT INTO sources (name, type, url) VALUES
  ('dev-seed-a', 'rss', 'https://example.com/a'),
  ('dev-seed-b', 'github_releases', 'https://example.com/b');

-- 14 raw items: mix of ages (published_at) and ingestion recency (ingested_at).
INSERT INTO raw_items (source_id, external_id, title, url, raw_content, published_at, ingested_at, enriched_at)
SELECT
  1 + (g % 2),
  'seed-' || g,
  'Seed Item ' || g,
  'https://example.com/item/' || g,
  'Seed content ' || g,
  now() - make_interval(days => (g * 3)),          -- ages 0,3,6,... days
  now() - make_interval(hours => (g * 5)),         -- ingested 0,5,10,... hours ago
  now()
FROM generate_series(0, 13) AS g;

-- One reel per raw item, varied attributes.
INSERT INTO reels (raw_item_id, summary, category, maturity, experimental,
                   relevance_score, quality_score, example, action, effort_tag, skill)
SELECT
  ri.id,
  'Zusammenfassung für ' || ri.title || '. Sachlich, zwei Sätze.',
  (ARRAY['claude-feature','tooling','technique','industry-news','research','opinion'])[1 + (ri.id % 6)],
  (ARRAY['experimental','emerging','established'])[1 + (ri.id % 3)],
  (ri.id % 5 = 0),
  20 + (ri.id * 11 % 80),                            -- relevance 20..99
  20 + (ri.id * 17 % 80),                            -- quality 20..99
  CASE WHEN ri.id % 3 = 0 THEN 'npm install -g @anthropic-ai/claude-code' END,
  CASE WHEN ri.id % 2 = 0 THEN 'Probier das direkt im nächsten Projekt aus.' END,
  CASE WHEN ri.id % 2 = 0 THEN (ARRAY['5-min-test','afternoon','know-only'])[1 + (ri.id % 3)] END,
  CASE WHEN ri.id % 2 = 0 THEN 'agentic-tool-use' ELSE 'mcp-servers' END
FROM raw_items ri;

SELECT count(*) AS reels,
       count(*) FILTER (WHERE quality_score >= 60) AS strong
FROM reels;
