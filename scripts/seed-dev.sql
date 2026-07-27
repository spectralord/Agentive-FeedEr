-- Dev/verification seed data (NOT used in production). DESTRUCTIVE: the
-- TRUNCATE below wipes every table listed and restarts identity sequences,
-- then reloads a fixed, hand-authored dataset. Safe to run repeatedly
-- (`npm run db:seed` / `npm run setup`) — it is always a full reset, never an
-- incremental upsert.
--
-- Goal (Epic 18 UX redesign, see docs/LOCAL_SETUP.md "you should see"
-- checklist): exercise every new surface a fresh clone needs to *see* to
-- confirm the redesign, not just pass tests:
--   - reels with and without a `skill` (Skill tab shown/hidden)
--   - confidence few/some/strong, and reels with no cluster at all (no badge)
--   - a caveat (Compact ⚠ marker + full text in the Context tab)
--   - a topic cluster with >= 2 members (ReelStackCard, "N sources on this
--     topic") — two of them, in fact (clusters 1 and 2 below)
--   - a cluster superseded by a newer one, still lifecycle_state='active'
--     (the "🕓 Newer available" notice + "Confirm superseded" form)
--   - reels with/without example, action, effort_tag
--   - writeup left NULL everywhere (T18.6: the placeholder path is what we
--     want to see here — deliberate, not an oversight)
--   - skill nodes in all four progress states: untouched (no user_progress
--     row), seen, tried, mastered (all four SkillRing rungs on /skills)
--   - one skill node with an experimental-dot (>50% of its reels
--     experimental=true) and one below that threshold
--   - a couple of experience_reports and one pipeline_runs row (/admin)
--   - quality_score >= 60 (QUALITY_THRESHOLD) for everything meant to show
--     up in the feed, plus one deliberately-below-threshold reel to prove
--     ADR 0004's "hidden, never deleted" behaviour
--
-- IDs below are relied upon directly (not looked up by name) — this only
-- works because RESTART IDENTITY guarantees sources start at 1, skill_nodes
-- at 1, topic_clusters at 1, and raw_items/reels are inserted 1:1 in lockstep
-- so raw_item #N always backs reel #N. Do not reorder the INSERTs below
-- without updating the FK literals that depend on them.

TRUNCATE TABLE
  sources, raw_items, reels, topic_clusters, skill_nodes,
  user_progress, user_progress_notes, experience_reports,
  pipeline_runs, interactions, app_state
  RESTART IDENTITY CASCADE;

-- ============================================================================
-- Sources (ids 1..5)
-- ============================================================================
INSERT INTO sources (name, type, url) VALUES
  ('anthropic-blog',           'rss',             'https://example.com/anthropic-blog'),
  ('simon-willison-blog',      'rss',             'https://example.com/simonw'),
  ('hn-frontpage',             'hn_algolia',      'https://example.com/hn'),
  ('github-releases-claude',   'github_releases', 'https://example.com/gh-releases'),
  ('dev-reddit-digest',        'reddit_rss',      'https://example.com/reddit-digest');

-- ============================================================================
-- Skill nodes (ids 1..4) — all `active` (SkillTagger-confirmed), one per
-- four-rung progress state below.
-- ============================================================================
INSERT INTO skill_nodes (slug, title, theme, description, status) VALUES
  ('agentic-tool-use', 'Agentic Tool Use', 'Agentic Workflows',
   'Chaining tools together so Claude plans and executes multi-step tasks itself.', 'active'),
  ('mcp-servers', 'MCP Servers', 'Agentic Workflows',
   'Building and connecting Model Context Protocol servers to give Claude new tools.', 'active'),
  ('prompt-caching', 'Prompt Caching', 'Cost & Performance',
   'Reusing cached prompt prefixes to cut latency and cost on repeated calls.', 'active'),
  ('computer-use', 'Computer Use', 'Agentic Workflows',
   'Letting Claude operate a GUI directly (mouse/keyboard) instead of an API.', 'active');

-- user_progress: node 1 = mastered, node 2 = tried, node 3 = seen,
-- node 4 = deliberately no row at all (untouched — T18.4/§9.4: no row is its
-- own visible ring state, distinct from "seen").
INSERT INTO user_progress (skill_node_id, status, note) VALUES
  (1, 'mastered', 'Using subagents daily now.'),
  (2, 'tried', 'Wired up the filesystem MCP server, still rough edges.'),
  (3, 'seen', NULL);

-- Adoption-log entries (T7.4) — only rows that were written with a note.
INSERT INTO user_progress_notes (skill_node_id, status, note) VALUES
  (1, 'mastered', 'Using subagents daily now.'),
  (2, 'tried', 'Wired up the filesystem MCP server, still rough edges.');

-- ============================================================================
-- Topic clusters (ids 1..3 first; id 4 references id 1, added after)
-- ============================================================================
INSERT INTO topic_clusters (title, confidence, independent_count, lifecycle_state) VALUES
  ('Claude Code subagents launch', 'strong', 4, 'active'),       -- id 1: 4 is_primary members below -> matches CONF_STRONG_MIN=4
  ('MCP server auth patterns', 'some', 2, 'active'),             -- id 2: 2 is_primary members -> matches CONF_SOME_MIN=2
  ('Extended thinking budget tuning', 'few', 1, 'active');       -- id 3: 1 member -> below CONF_SOME_MIN -> "few"

-- id 4: superseded-but-not-yet-confirmed cluster (ADR 0008 human-in-the-loop
-- — freshness pass proposed this, a human hasn't clicked "Confirm superseded"
-- yet, so lifecycle_state stays 'active'). confidence intentionally NULL
-- here: the confidence and freshness passes are independent per-cluster
-- computations (schema.ts comment on topic_clusters) — this row shows the
-- freshness half ran while the confidence half hasn't, on purpose.
INSERT INTO topic_clusters (title, confidence, independent_count, lifecycle_state, superseded_by_cluster_id, supersede_reason) VALUES
  ('Custom subagent workaround (pre-native)', NULL, NULL, 'active', 1,
   'Anthropic shipped native Claude Code subagents; this manual multi-process workaround is obsolete.');

-- ============================================================================
-- Raw items + reels, in lockstep (raw_item #N backs reel #N), ids 1..16.
-- writeup is always NULL (left out of the INSERT -> column default NULL) —
-- deliberate, see header comment.
-- ============================================================================

INSERT INTO raw_items (source_id, external_id, title, url, published_at, ingested_at, enriched_at) VALUES
  (1, 'seed-1',  'Claude Code ships native subagents',                          'https://example.com/item/1',  now() - interval '1 day',   now() - interval '23 hours', now() - interval '20 hours'),
  (2, 'seed-2',  'First impressions of Claude Code subagents',                  'https://example.com/item/2',  now() - interval '2 days',  now() - interval '47 hours', now() - interval '44 hours'),
  (3, 'seed-3',  'Show HN: I orchestrated 5 subagents to migrate a monorepo',   'https://example.com/item/3',  now() - interval '3 days',  now() - interval '71 hours', now() - interval '70 hours'),
  (4, 'seed-4',  'claude-code v2.4: subagents, MCP improvements',               'https://example.com/item/4',  now() - interval '4 days',  now() - interval '95 hours', now() - interval '90 hours'),
  (1, 'seed-5',  'Auth patterns for self-hosted MCP servers',                   'https://example.com/item/5',  now() - interval '5 days',  now() - interval '119 hours', now() - interval '115 hours'),
  (5, 'seed-6',  'We got burned by a static MCP bearer token',                  'https://example.com/item/6',  now() - interval '6 days',  now() - interval '143 hours', now() - interval '140 hours'),
  (2, 'seed-7',  'Tuning extended-thinking token budgets for research tasks',   'https://example.com/item/7',  now() - interval '7 days',  now() - interval '167 hours', now() - interval '160 hours'),
  (3, 'seed-8',  'A hacky way to fake multi-agent orchestration pre-subagents','https://example.com/item/8',  now() - interval '25 days', now() - interval '24 days',  now() - interval '24 days'),
  (4, 'seed-9',  'Claude computer use: a week of daily driving',                'https://example.com/item/9',  now() - interval '9 days',  now() - interval '8 days',   now() - interval '8 days'),
  (1, 'seed-10', 'Computer use isn''t ready for unattended runs yet',           'https://example.com/item/10', now() - interval '10 days', now() - interval '9 days',   now() - interval '9 days'),
  (5, 'seed-11', 'A field guide to agentic tool use patterns',                  'https://example.com/item/11', now() - interval '11 days', now() - interval '10 days',  now() - interval '10 days'),
  (2, 'seed-12', 'Building your first MCP server from scratch',                 'https://example.com/item/12', now() - interval '12 days', now() - interval '11 days',  now() - interval '11 days'),
  (3, 'seed-13', 'Prompt caching cut our bill by 40%',                          'https://example.com/item/13', now() - interval '13 days', now() - interval '12 days',  now() - interval '12 days'),
  (4, 'seed-14', 'Weekly roundup: what shipped in the Claude ecosystem',        'https://example.com/item/14', now() - interval '14 days', now() - interval '13 days',  now() - interval '13 days'),
  (1, 'seed-15', 'Quick note: Claude''s context window keeps growing',         'https://example.com/item/15', now() - interval '15 days', now() - interval '14 days',  now() - interval '14 days'),
  (2, 'seed-16', 'An early, rough take nobody should read yet',                 'https://example.com/item/16', now() - interval '16 days', now() - interval '15 days',  now() - interval '15 days');

INSERT INTO reels (
  raw_item_id, summary, category, maturity, experimental, relevance_score, quality_score,
  example, action, effort_tag, skill, topic_cluster_id, is_primary, caveat, caveat_checked_at
) VALUES
  -- 1: Cluster 1 member A (primary) — has skill, example, action.
  (1, 'Anthropic''s own announcement: Claude Code now supports native subagents for parallel, scoped tasks.',
   'claude-feature', 'established', false, 92, 88,
   'claude --agent researcher "find recent papers on X"',
   'Try spinning up a research subagent in your next multi-step task.',
   '5-min-test', 'agentic-tool-use', 1, true, NULL, NULL),

  -- 2: Cluster 1 member B — no skill, no example/action.
  (2, 'A hands-on first look at the new subagent feature, with a few rough edges noted.',
   'tooling', 'emerging', false, 80, 76,
   NULL, NULL, NULL, NULL, 1, true, NULL, NULL),

  -- 3: Cluster 1 member C — no skill.
  (3, 'A Show HN writeup of orchestrating five subagents to migrate a large monorepo overnight.',
   'industry-news', 'emerging', false, 74, 70,
   NULL, NULL, NULL, NULL, 1, true, NULL, NULL),

  -- 4: Cluster 1 member D — different skill, example/action set.
  (4, 'Release notes for claude-code v2.4: subagents plus several MCP client fixes.',
   'tooling', 'established', false, 85, 82,
   'See the CHANGELOG for the new `--agent` flag.',
   'Update claude-code and skim the subagent docs.',
   'afternoon', 'mcp-servers', 1, true, NULL, NULL),

  -- 5: Cluster 2 member A (primary) — mcp-servers skill.
  (5, 'A practical rundown of short-lived-token auth patterns for self-hosted MCP servers.',
   'technique', 'emerging', false, 70, 71,
   'Use a short-lived token minted per MCP session, not a static bearer token.',
   'Rotate any long-lived MCP server tokens you have lying around.',
   '5-min-test', 'mcp-servers', 2, true, NULL, NULL),

  -- 6: Cluster 2 member B — no skill.
  (6, 'A cautionary post-mortem about a static MCP bearer token that leaked via logs.',
   'opinion', 'emerging', false, 60, 65,
   NULL, NULL, NULL, NULL, 2, true, NULL, NULL),

  -- 7: Cluster 3 (single member -> confidence 'few', still renders solo).
  -- experimental=true — one of computer-use's 3 reels (see 9, 10 below).
  (7, 'A deep-dive into picking extended-thinking token budgets for different research task sizes.',
   'technique', 'experimental', true, 65, 75,
   NULL, NULL, NULL, 'computer-use', 3, true, NULL, NULL),

  -- 8: Cluster 4 member (superseded workaround) — has a caveat.
  (8, 'A workaround for coordinating multiple Claude processes before native subagents existed.',
   'technique', 'experimental', false, 55, 68,
   'Spawn N separate `claude` processes and merge their stdout by hand.',
   NULL, NULL, 'agentic-tool-use', 4, true,
   'This predates native Claude Code subagents (see the newer cluster linked above) — a historical workaround, not current best practice.',
   now() - interval '1 hour'),

  -- 9: Solo, no cluster. computer-use, experimental=true.
  (9, 'A week-long diary of using Claude''s computer-use mode as a daily driver for GUI tasks.',
   'claude-feature', 'experimental', true, 78, 80,
   'Let Claude click through a settings GUI to change one config value.',
   'Try computer use for one repetitive GUI task this week.',
   'afternoon', 'computer-use', NULL, NULL, NULL, NULL),

  -- 10: Solo, no cluster. computer-use, experimental=false (below-threshold
  -- half of the 2-of-3 experimental majority for this node).
  (10, 'A skeptical take arguing computer-use mode isn''t reliable enough yet for unattended runs.',
   'opinion', 'emerging', false, 58, 62,
   NULL, NULL, NULL, 'computer-use', NULL, NULL, NULL, NULL),

  -- 11: Solo, no cluster. agentic-tool-use, experimental=false (keeps that
  -- node's ratio at 0-of-3, below the experimental-dot threshold).
  (11, 'A field guide walking through common agentic tool-use patterns and when to reach for each.',
   'technique', 'established', false, 88, 90,
   'Chain a search tool -> a fetch tool -> a summarize step.',
   'Sketch the tool chain for your next feature before writing any prompts.',
   'afternoon', 'agentic-tool-use', NULL, NULL, NULL, NULL),

  -- 12: Solo, no cluster. mcp-servers.
  (12, 'A tutorial building a minimal MCP server exposing a single search tool from scratch.',
   'technique', 'emerging', false, 72, 74,
   'A minimal MCP server exposing one `search` tool.',
   'Scaffold a one-tool MCP server this afternoon.',
   'afternoon', 'mcp-servers', NULL, NULL, NULL, NULL),

  -- 13: Solo, no cluster. prompt-caching.
  (13, 'A cost breakdown showing a 40% bill reduction after adopting prompt caching.',
   'technique', 'established', false, 81, 84,
   'Cache the system prompt and tool definitions; vary only the user turn.',
   'Add cache_control to your longest static prompt block.',
   '5-min-test', 'prompt-caching', NULL, NULL, NULL, NULL),

  -- 14: Solo, no skill, but WITH example/action/effort_tag (skill tab hidden
  -- either way — that block only ever renders under an active skill node).
  (14, 'A weekly roundup of everything that shipped across the Claude ecosystem this week.',
   'industry-news', 'emerging', false, 95, 95,
   'Nothing to run — this is a links roundup.',
   'Skim the roundup for anything you missed this week.',
   'know-only', NULL, NULL, NULL, NULL, NULL),

  -- 15: Solo, minimal — no skill, no example/action/effort_tag, no cluster,
  -- no caveat. quality_score=61, just above QUALITY_THRESHOLD (60).
  (15, 'A short note observing that Claude''s context window keeps getting larger release over release.',
   'industry-news', 'emerging', false, 50, 61,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

  -- 16: Deliberately BELOW QUALITY_THRESHOLD (60) — proves ADR 0004's
  -- "hidden by default, never deleted" behaviour. Should NOT appear in the
  -- default feed; only visible with the "show weak" override.
  (16, 'A rough, low-confidence early take that quality-gating should keep out of the default feed.',
   'opinion', 'experimental', false, 30, 45,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- One more raw item, deliberately left unenriched (no reel) so /admin's
-- "Unenriched" tile has something to show.
INSERT INTO raw_items (source_id, external_id, title, url, published_at, ingested_at, enriched_at) VALUES
  (3, 'seed-17', 'Not yet enriched: a fresh RSS item still waiting on the pipeline', 'https://example.com/item/17',
   now() - interval '2 hours', now() - interval '30 minutes', NULL);

-- ============================================================================
-- Experience reports (Epic 9) — "a couple", one own + one curated.
-- ============================================================================
-- Dollar-quoted bodies ($md$...$md$) rather than '' concatenation: no
-- apostrophe-escaping needed and real newlines survive without relying on
-- adjacent-string-literal concatenation (which only C-style-escapes the
-- literal carrying the E prefix, not the ones after it).
INSERT INTO experience_reports (title, body, author_type, author_label, important, relevance_score, lifecycle_state, source_url) VALUES
  ('Two weeks with Claude Code subagents',
   $md$Spent the last two weeks routing anything multi-step through a subagent instead of one long prompt.

**What worked:** research + implementation split cleanly into separate agents with separate context.

**What didn't:** coordinating three subagents on one shared file still needs a human in the loop.$md$,
   'own', 'Ich', true, NULL, 'active', NULL),
  ('Reddit take: MCP servers still feel fragile',
   $md$A curated pull from r/programming — several commenters report auth/session bugs on self-hosted MCP servers under real load. Matches what we're seeing internally; worth watching before relying on one in a critical path.$md$,
   'curated', 'r/programming (curated)', false, 55, 'active', 'https://example.com/reddit/example-thread');

-- ============================================================================
-- Pipeline run (Epic 13, /admin) — one representative full run.
-- ============================================================================
INSERT INTO pipeline_runs (trigger, mode, status, started_at, finished_at, summary) VALUES (
  'manual', 'full', 'success', now() - interval '1 hour', now() - interval '58 minutes',
  '{
    "ingestion": {
      "totalInserted": 17,
      "perSource": [
        {"name": "anthropic-blog"}, {"name": "simon-willison-blog"},
        {"name": "hn-frontpage"}, {"name": "github-releases-claude"},
        {"name": "dev-reddit-digest"}
      ]
    },
    "enrichment": {"processed": 16, "succeeded": 16, "failed": 0},
    "verifier": {"processed": 16, "flagged": 1, "failed": 0},
    "skillTagging": {"processed": 16, "matched": 10, "proposed": 2, "failed": 0},
    "clustering": {"processed": 16, "matched": 8, "proposed": 0, "failed": 0},
    "knowledgeCheck": {
      "confidence": [
        {"clusterId": 1, "independentCount": 4, "confidence": "strong"},
        {"clusterId": 2, "independentCount": 2, "confidence": "some"},
        {"clusterId": 3, "independentCount": 1, "confidence": "few"}
      ],
      "freshness": {"groupsChecked": 4, "supersededFound": 1, "failed": 0}
    },
    "feedback": {"ran": true, "newInteractions": 3, "bulletCount": 2}
  }'::jsonb
);

-- ============================================================================
-- Interactions (Epic 6) — a few, so /saved and history have content.
-- ============================================================================
INSERT INTO interactions (reel_id, type, note) VALUES
  (1, 'save', 'Want to try this on the next project.'),
  (1, 'up', NULL),
  (11, 'save', NULL),
  (16, 'down', 'Too rough, correctly quality-gated anyway.');

-- ============================================================================
-- App state (Epic 6) — rolling feedback summary, referenced by the
-- pipeline_runs row above.
-- ============================================================================
INSERT INTO app_state (key, value) VALUES (
  'feedback_summary',
  '{"bullets": ["Subagent content keeps getting saved/upvoted.", "MCP auth posts get mixed reactions."]}'::jsonb
);

-- ============================================================================
-- Sanity summary (printed after psql runs this file).
-- ============================================================================
SELECT
  (SELECT count(*) FROM sources) AS sources,
  (SELECT count(*) FROM raw_items) AS raw_items,
  (SELECT count(*) FROM reels) AS reels,
  (SELECT count(*) FROM reels WHERE quality_score >= 60) AS visible_reels,
  (SELECT count(*) FROM topic_clusters) AS topic_clusters,
  (SELECT count(*) FROM skill_nodes) AS skill_nodes,
  (SELECT count(*) FROM user_progress) AS user_progress_rows,
  (SELECT count(*) FROM experience_reports) AS experience_reports,
  (SELECT count(*) FROM pipeline_runs) AS pipeline_runs;
