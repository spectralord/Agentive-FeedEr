-- Epic 21, T21.1 (ADR 0020 decision 6): skill_nodes.theme drifted onto
-- free-text display strings ("Agentic Workflows", "Cost & Performance")
-- that match none of the 8 THEMES slugs (src/lib/skills.ts), because
-- scripts/seed-dev.sql wrote them directly into a free-form text column
-- instead of going through the SkillTagger's enum-validated propose_theme.
-- ADR 0020 decision 1 keys THEME_LAYOUT off THEMES, so an off-vocabulary
-- theme has no map region — this is a prerequisite for the rest of the
-- epic, not incidental cleanup.
--
-- Owner decision 2026-08-01 (see epic-21-constellation-stage-a.md T21.1,
-- ADR 0020 decision 6 amendment): the mapping below is explicitly not a
-- design decision requiring defence — just apply it. The 8 slug values
-- themselves are not settled either; only that the vocabulary is closed and
-- constrained matters right now.
--
--   Agentic Workflows -> agents
--   Cost & Performance -> prompting

UPDATE "skill_nodes" SET "theme" = 'agents' WHERE "theme" = 'Agentic Workflows';
--> statement-breakpoint
UPDATE "skill_nodes" SET "theme" = 'prompting' WHERE "theme" = 'Cost & Performance';
--> statement-breakpoint
-- Constrain the column at the DB level so this cannot recur silently.
-- drizzle's text("theme", { enum: THEMES }) (src/db/schema.ts) is a
-- TypeScript-only narrowing — every other "enum" column in this project
-- (reels.category, reels.maturity, sources.type, ...) relies on the same
-- convention with no DB-level check, but T21.1 explicitly requires an
-- off-vocabulary insert to fail at the DB level, so this column gets a real
-- CHECK constraint (kept as plain text + CHECK rather than a Postgres ENUM
-- type, since ENUM would require its own ALTER TYPE migration to extend the
-- vocabulary later, whereas CHECK is a one-line DROP/ADD).
ALTER TABLE "skill_nodes" ADD CONSTRAINT "skill_nodes_theme_check" CHECK (
  "theme" IN ('parallelization', 'agents', 'tooling', 'prompting', 'evaluation', 'models', 'integration', 'industry')
);
