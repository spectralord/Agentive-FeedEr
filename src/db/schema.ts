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

export type Source = typeof sources.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
