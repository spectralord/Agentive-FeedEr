import type { Source } from "@/db/schema";
import { fetchText } from "../http";
import { capContent, type NormalizedItem } from "../types";

interface HnHit {
  objectID: string;
  title?: string;
  url?: string | null;
  story_text?: string | null;
  created_at?: string;
}

export async function fetchHnItems(source: Source): Promise<NormalizedItem[]> {
  const config = (source.config ?? {}) as { query?: string; minPoints?: number };
  const params = new URLSearchParams({
    tags: "story",
    query: config.query ?? "",
    numericFilters: `points>${config.minPoints ?? 0}`,
  });
  const json = await fetchText(`${source.url}?${params}`);
  return parseHnJson(json);
}

export function parseHnJson(json: string): NormalizedItem[] {
  const data = JSON.parse(json) as { hits?: HnHit[] };
  const items: NormalizedItem[] = [];
  for (const hit of data.hits ?? []) {
    if (!hit.title || !hit.created_at) continue;
    const publishedAt = new Date(hit.created_at);
    if (Number.isNaN(publishedAt.getTime())) continue;
    items.push({
      externalId: hit.objectID,
      title: hit.title,
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      content: capContent([hit.title, hit.story_text ?? ""].filter(Boolean).join("\n\n")),
      publishedAt,
    });
  }
  return items;
}
