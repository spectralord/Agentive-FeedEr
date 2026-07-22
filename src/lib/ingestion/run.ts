import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { rawItems, sources, type Source } from "@/db/schema";
import { getEnabledSources, seedSources } from "@/lib/sources";
import { fetchers } from "./fetchers";
import type { Fetcher } from "./types";

export interface SourceResult {
  name: string;
  fetched: number;
  inserted: number;
  error?: string;
}

export interface IngestionResult {
  perSource: SourceResult[];
  totalInserted: number;
}

/** First-run flood guard: ignore anything older than this. */
export const MAX_ITEM_AGE_DAYS = 30;

export async function runIngestion(
  db: NodePgDatabase<typeof schema>,
  fetcherMap: Record<string, Fetcher> = fetchers,
  now: Date = new Date(),
): Promise<IngestionResult> {
  await seedSources(db);

  const cutoff = new Date(now.getTime() - MAX_ITEM_AGE_DAYS * 86_400_000);
  const perSource: SourceResult[] = [];
  let totalInserted = 0;

  for (const source of await getEnabledSources(db)) {
    try {
      const result = await ingestSource(db, source, fetcherMap, cutoff);
      perSource.push(result);
      totalInserted += result.inserted;
    } catch (error) {
      perSource.push({
        name: source.name,
        fetched: 0,
        inserted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { perSource, totalInserted };
}

async function ingestSource(
  db: NodePgDatabase<typeof schema>,
  source: Source,
  fetcherMap: Record<string, Fetcher>,
  cutoff: Date,
): Promise<SourceResult> {
  const fetcher = fetcherMap[source.type];
  if (!fetcher) throw new Error(`No fetcher for source type "${source.type}"`);

  const items = await fetcher(source);
  const fresh = items.filter((item) => item.publishedAt >= cutoff);

  let inserted = 0;
  for (const item of fresh) {
    const result = await db
      .insert(rawItems)
      .values({
        sourceId: source.id,
        externalId: item.externalId,
        title: item.title,
        url: item.url,
        rawContent: item.content,
        publishedAt: item.publishedAt,
      })
      .onConflictDoNothing({ target: [rawItems.sourceId, rawItems.externalId] })
      .returning({ id: rawItems.id });
    inserted += result.length;
  }

  await db.update(sources).set({ lastPolledAt: new Date() }).where(eq(sources.id, source.id));

  return { name: source.name, fetched: items.length, inserted };
}
