import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { THEMES } from "@/lib/skills";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type", {
    enum: ["rss", "hn_algolia", "reddit_rss", "github_releases"],
  }).notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").notNull().default({}),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
});

export const rawItems = pgTable(
  "raw_items",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    rawContent: text("raw_content").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    enrichError: text("enrich_error"),
  },
  (t) => [uniqueIndex("raw_items_source_external_uq").on(t.sourceId, t.externalId)],
);

// Epic 15: narrow, specific topic clusters (ADR 0013) — the "same concrete
// thing and its usage" grouping used for corroboration/freshness (Epic 11),
// distinct from the broad Skill-Node grouping (Epic 12). `lastMatchedAt`
// drives the Match-or-Propose "active window" (only clusters matched within
// `CLUSTER_WINDOW_DAYS` are match candidates for a new reel).
//
// Epic 11 (ADR 0012, T11.1): the Topic-Knowledge-Check computes two outputs
// per cluster from one cross-source comparison — `confidence` (corroboration,
// grounded count of independent `is_primary` members, T11.2) and
// `freshness`/supersession (a grounded LLM comparison against clusters
// sharing a skill-node, T11.3). Both are nullable until the check has run at
// least once. Supersession is conservative (ADR 0008 human-in-the-loop):
// `supersededByClusterId`/`supersedeReason` are a *proposal* set by T11.3;
// `lifecycleState` only flips to `deprecated` once a human confirms via the
// T11.5 route — the freshness pass itself never changes it.
export const topicClusters = pgTable("topic_clusters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: text("confidence", { enum: ["few", "some", "strong"] }),
  independentCount: integer("independent_count"),
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated"] })
    .notNull()
    .default("active"),
  supersededByClusterId: integer("superseded_by_cluster_id").references(
    (): AnyPgColumn => topicClusters.id,
  ),
  supersedeReason: text("supersede_reason"),
  knowledgeCheckedAt: timestamp("knowledge_checked_at", { withTimezone: true }),
});

export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  rawItemId: integer("raw_item_id")
    .notNull()
    .references(() => rawItems.id)
    .unique(),
  summary: text("summary").notNull(),
  category: text("category", {
    enum: ["claude-feature", "tooling", "technique", "industry-news", "research", "opinion"],
  }).notNull(),
  maturity: text("maturity", {
    enum: ["experimental", "emerging", "established"],
  }).notNull(),
  experimental: boolean("experimental").notNull().default(false),
  relevanceScore: integer("relevance_score").notNull(),
  qualityScore: integer("quality_score").notNull(),
  example: text("example"),
  action: text("action"),
  effortTag: text("effort_tag", { enum: ["5-min-test", "afternoon", "know-only"] }),
  skill: text("skill"),
  // Epic 15 (ADR 0013): reserved since Epic 2, activated here as a real FK.
  // Nullable — null until the clustering pass processes this reel.
  topicClusterId: integer("topic_cluster_id").references(() => topicClusters.id),
  // Epic 15: set by the clustering pass alongside topicClusterId. true =
  // independent/first-hand account; false = recognizable reblog of another
  // cluster member; null = not yet clustered. See ADR 0013 point 4.
  isPrimary: boolean("is_primary"),
  // Epic 10 (ADR 0011, T10.1): Stage-1 Reel-Verifier output — a short,
  // grounded fidelity/skepticism caveat, or null when the critic pass found
  // nothing to flag (the normal case). Deliberately does NOT feed
  // quality_score (ADR 0004: a separate signal, display-layer only).
  // `caveat` itself stays nullable both before AND after a legitimate run
  // (null can mean "not checked yet" or "checked, no issue found"), so
  // `caveatCheckedAt` (same "timestamp marks the check ran" pattern as
  // topicClusters.knowledgeCheckedAt, Epic 11) is the idempotency marker —
  // see src/lib/verifier/run.ts.
  caveat: text("caveat"),
  caveatCheckedAt: timestamp("caveat_checked_at", { withTimezone: true }),
  // Epic 18 (ADR 0017 decision 1, accepted; T18.6): longer-form prose for the
  // Reel Detail view's Write-up tab. Nullable — the second enrichment pass
  // that fills it (ADR 0017 decisions 2-4) is still deferred/proposed, so
  // this stays NULL everywhere for now. The Write-up tab renders an
  // explicit placeholder while null; it is never hidden either way (see
  // docs/plan/epic-18-ux-implementation.md, judgment call 2).
  writeup: text("writeup"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 9: subjective experience reports — a separate content type from
// `reels`, deliberately NOT subject to ADR 0005 (sourced-only). See ADR 0007
// (own content type, author instead of source) and ADR 0008 (lifecycle_state
// instead of a boolean, no auto-delete).
export const experienceReports = pgTable("experience_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(), // Markdown
  authorType: text("author_type", { enum: ["own", "curated", "colleague"] }).notNull(),
  authorLabel: text("author_label").notNull(),
  important: boolean("important").notNull().default(false), // "⭐ wichtig" (self-highlight)
  relevanceScore: integer("relevance_score"), // curated only; MVP always null
  skill: text("skill"), // from SkillTagger (Epic 12); MVP null
  lifecycleState: text("lifecycle_state", { enum: ["active", "deprecated", "archived"] })
    .notNull()
    .default("active"), // ADR 0008; no auto-delete
  lifecycleReason: text("lifecycle_reason"), // reason when deprecated/archived
  supersededByReportId: integer("superseded_by_report_id"),
  sourceUrl: text("source_url"), // curated only
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 12: canonical skill/competency nodes the SkillTagger assigns content to
// (Match-or-Propose, ADR 0009). This is the authoritative schema until Epic 7
// (Skill-Map) builds on top of it. `status: pending` = proposed by the tagger,
// not yet confirmed by the user (T12.6); `active` = confirmed, matchable.
export const skillNodes = pgTable("skill_nodes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // Epic 21 (T21.1, ADR 0020 decision 6): constrained to the 8 THEMES slugs
  // — was bare text().notNull(), which let scripts/seed-dev.sql drift onto
  // free-text values ("Agentic Workflows", "Cost & Performance") that matched
  // none of them. THEME_LAYOUT (T21.2) keys off THEMES, so an off-vocabulary
  // theme has no map region; the DB now rejects one outright.
  theme: text("theme", { enum: THEMES }).notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["active", "pending"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Epic 21 (T21.3, ADR 0020 decision 2): manual-override position within
  // the node's THEME_LAYOUT circle. Nullable — an unplaced node (the normal
  // case, since there is no layout pass yet, ADR 0020 decision 7) simply
  // falls through to resolveNodePosition's deterministic hash tier. Only
  // ever written by the drag-to-place UI (T21.5); nothing else should set
  // positionLocked=true.
  positionX: real("position_x"),
  positionY: real("position_y"),
  positionLocked: boolean("position_locked").notNull().default(false),
});

// Epic 7: self-declared progress per skill node (Skill-Map, Variante A — no
// prerequisite tree, no gates). One row per node (`skillNodeId` is the
// primary key, no separate `id`) — the current status + most recent note, so
// map tiles/detail views never need a join to show "where am I on this
// node". Full note history lives in `user_progress_notes` below; this
// column always mirrors the latest entry (see src/lib/skills/progress.ts).
export const userProgress = pgTable("user_progress", {
  skillNodeId: integer("skill_node_id")
    .primaryKey()
    .references(() => skillNodes.id),
  status: text("status", { enum: ["seen", "tried", "mastered"] }).notNull().default("seen"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 7 (T7.4, Adoption-Log): append-only history of notes attached to a
// status change on a node. A plain small table (not a jsonb array on
// user_progress) — same style as `interactions` (event rows with a note),
// and lets the Adoption-Log query "all notes, newest first, across every
// node" with a single indexed order-by instead of unnesting jsonb across
// rows. Only written when `setProgress` is called with a non-empty note
// (see src/lib/skills/progress.ts) — a bare status change with no note is
// not "adopted", so it doesn't clutter the log.
export const userProgressNotes = pgTable("user_progress_notes", {
  id: serial("id").primaryKey(),
  skillNodeId: integer("skill_node_id")
    .notNull()
    .references(() => skillNodes.id),
  status: text("status", { enum: ["seen", "tried", "mastered"] }).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 13: history of daily-pipeline runs (cron and manual admin triggers share
// this table). See ADR 0010.
export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger", { enum: ["manual", "cron"] }).notNull(),
  mode: text("mode", { enum: ["full", "ingestion", "enrichment"] }).notNull(),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  summary: jsonb("summary"),
  error: text("error"),
});

// Epic 6: user reactions to a reel (save/hide/up/down). Toggle semantics —
// the same type on the same reel a second time deletes the row again (see
// src/lib/interactions.ts). Deliberately no "tried"/done checkbox (revised
// scope, see docs/plan/epic-6-interactions.md).
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id")
    .notNull()
    .references(() => reels.id),
  type: text("type", { enum: ["save", "hide", "up", "down"] }).notNull(),
  note: text("note"), // optional (e.g. "why saved")
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 6: generic key-value store for small derived app state that doesn't
// warrant its own table — currently only the rolling feedback summary
// (app_state["feedback_summary"], see src/lib/feedback/run.ts).
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Epic 20 (ADR 0019): a completed Actionable (= a Reel's `action`, promoted
// to checkable). One row per completed Reel — `reelId` is `unique()`, so
// ticking is idempotent (a second toggle deletes the row, see
// src/lib/actionables/index.ts's toggleActionable) rather than a counter of
// repeated completions.
//
// `skillNodeId` is resolved from `reels.skill` AT COMPLETION TIME and stored
// alongside, not re-derived on every read — so the roll-up to a node
// survives the Reel's `skill` tag changing later (re-tagging shouldn't
// silently move history to a different node).
//
// `actionText`/`effortTag` are a deliberate snapshot (ADR 0019 decision 5),
// NOT a duplication for query convenience: `reels.action` is mutable (a
// re-enrichment pass can rewrite it), so without a snapshot, ticking off
// "try X" and later finding the column says "try Y" would silently rewrite
// the user's own history. Uncompleted Actionables remain a pure view over
// `reels.action` — text is captured here only at the moment completion
// turns it into a historical fact. Do not remove this in favour of a live
// join; that is the whole point of the decision.
export const actionableCompletions = pgTable("actionable_completions", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id")
    .notNull()
    .references(() => reels.id)
    .unique(),
  skillNodeId: integer("skill_node_id")
    .notNull()
    .references(() => skillNodes.id),
  actionText: text("action_text").notNull(),
  effortTag: text("effort_tag", { enum: ["5-min-test", "afternoon", "know-only"] }),
  note: text("note"),
  doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Source = typeof sources.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
export type SkillNode = typeof skillNodes.$inferSelect;
export type NewSkillNode = typeof skillNodes.$inferInsert;
export type ExperienceReport = typeof experienceReports.$inferSelect;
export type NewExperienceReport = typeof experienceReports.$inferInsert;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type AppStateRow = typeof appState.$inferSelect;
export type NewAppStateRow = typeof appState.$inferInsert;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
export type UserProgressNote = typeof userProgressNotes.$inferSelect;
export type NewUserProgressNote = typeof userProgressNotes.$inferInsert;
export type TopicCluster = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;
export type ActionableCompletion = typeof actionableCompletions.$inferSelect;
export type NewActionableCompletion = typeof actionableCompletions.$inferInsert;
