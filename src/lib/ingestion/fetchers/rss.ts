import Parser from "rss-parser";
import type { Source } from "@/db/schema";
import { fetchText } from "../http";
import { capContent, type NormalizedItem } from "../types";

const parser = new Parser();

/** Shared by rss, reddit_rss and github_releases sources (all RSS/Atom XML). */
export async function fetchRssItems(source: Source): Promise<NormalizedItem[]> {
  const xml = await fetchText(source.url);
  return parseRssXml(xml);
}

export async function parseRssXml(xml: string): Promise<NormalizedItem[]> {
  const feed = await parser.parseString(xml);
  const items: NormalizedItem[] = [];
  for (const item of feed.items) {
    const url = item.link;
    const dateStr = item.isoDate ?? item.pubDate;
    if (!url || !item.title || !dateStr) continue; // skip malformed entries
    const publishedAt = new Date(dateStr);
    if (Number.isNaN(publishedAt.getTime())) continue;
    // RSS puts the stable id in <guid>, Atom in <id> (mapped to item.id).
    const atomId = (item as { id?: string }).id;
    items.push({
      externalId: item.guid ?? atomId ?? url,
      title: item.title,
      url,
      content: capContent(item.contentSnippet ?? item.content ?? ""),
      publishedAt,
    });
  }
  return items;
}
