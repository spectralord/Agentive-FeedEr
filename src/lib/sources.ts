import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { sources } from "@/db/schema";

export type SourceType = "rss" | "hn_algolia" | "reddit_rss" | "github_releases";

export interface RegistryEntry {
  name: string;
  type: SourceType;
  url: string;
  config?: Record<string, unknown>;
  /** Seed as disabled (e.g. URL not yet verified or known-broken). */
  disabled?: boolean;
}

/**
 * Code is the source of truth for which sources exist (see docs/plan/epic-1).
 * The DB row only carries state (enabled, last_polled_at).
 * URL verification results are tracked in docs/plan/epic-1-ingestion.md (T1.6).
 */
export const SOURCE_REGISTRY: RegistryEntry[] = [
  { name: "simon-willison", type: "rss", url: "https://simonwillison.net/atom/everything/" },
  {
    name: "hn-claude",
    type: "hn_algolia",
    url: "https://hn.algolia.com/api/v1/search_by_date",
    config: { query: "Claude", minPoints: 20 },
  },
  {
    name: "hn-ai-agents",
    type: "hn_algolia",
    url: "https://hn.algolia.com/api/v1/search_by_date",
    config: { query: "AI agent", minPoints: 30 },
  },
  { name: "reddit-claudeai", type: "reddit_rss", url: "https://www.reddit.com/r/ClaudeAI/top/.rss?t=day" },
  { name: "reddit-localllama", type: "reddit_rss", url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day" },
  { name: "huggingface-blog", type: "rss", url: "https://huggingface.co/blog/feed.xml" },
  { name: "openai-news", type: "rss", url: "https://openai.com/news/rss.xml" },
  {
    name: "claude-code-releases",
    type: "github_releases",
    url: "https://github.com/anthropics/claude-code/releases.atom",
  },
  {
    name: "anthropic-sdk-releases",
    type: "github_releases",
    url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom",
  },
  { name: "latent-space", type: "rss", url: "https://www.latent.space/feed" },
];

/**
 * Upserts the registry into the sources table, matching on name.
 * Existing rows keep their state (enabled, last_polled_at); type/url/config are
 * refreshed from code. New entries are inserted (enabled unless disabled here).
 */
export async function seedSources(db: NodePgDatabase<typeof schema>): Promise<void> {
  for (const entry of SOURCE_REGISTRY) {
    await db
      .insert(sources)
      .values({
        name: entry.name,
        type: entry.type,
        url: entry.url,
        config: entry.config ?? {},
        enabled: !entry.disabled,
      })
      .onConflictDoUpdate({
        target: sources.name,
        set: { type: entry.type, url: entry.url, config: entry.config ?? {} },
      });
  }
}

export async function getEnabledSources(db: NodePgDatabase<typeof schema>) {
  return db.select().from(sources).where(eq(sources.enabled, true));
}
