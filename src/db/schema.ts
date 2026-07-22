import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
  topicClusterId: integer("topic_cluster_id"),
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

export type Source = typeof sources.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
export type ExperienceReport = typeof experienceReports.$inferSelect;
export type NewExperienceReport = typeof experienceReports.$inferInsert;
