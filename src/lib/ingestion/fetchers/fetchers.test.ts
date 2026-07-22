import { describe, expect, it } from "vitest";
import { MAX_CONTENT_LENGTH } from "../types";
import { parseHnJson } from "./hnAlgolia";
import { parseRssXml } from "./rss";

const rssFixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  <item>
    <title>Prompt caching explained</title>
    <link>https://example.com/prompt-caching</link>
    <guid>https://example.com/prompt-caching</guid>
    <pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>
    <description>How prompt caching cuts costs.</description>
  </item>
  <item>
    <title>Entry without a date</title>
    <link>https://example.com/no-date</link>
  </item>
  <item>
    <title>Huge entry</title>
    <link>https://example.com/huge</link>
    <pubDate>Tue, 21 Jul 2026 09:00:00 GMT</pubDate>
    <description>${"x".repeat(10_000)}</description>
  </item>
</channel></rss>`;

const atomFixture = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Release notes</title>
  <entry>
    <id>tag:github.com,2008:Repository/1/v1.2.0</id>
    <title>v1.2.0</title>
    <link href="https://github.com/anthropics/claude-code/releases/tag/v1.2.0"/>
    <updated>2026-07-19T12:00:00Z</updated>
    <content type="html">Adds subagent support.</content>
  </entry>
</feed>`;

const hnFixture = JSON.stringify({
  hits: [
    {
      objectID: "41000001",
      title: "Claude ships new agent SDK",
      url: "https://example.com/agent-sdk",
      created_at: "2026-07-20T08:30:00Z",
      story_text: null,
    },
    {
      objectID: "41000002",
      title: "Ask HN: best agentic workflow?",
      url: null,
      created_at: "2026-07-20T09:00:00Z",
      story_text: "What do you use?",
    },
    { objectID: "41000003", title: null, created_at: "2026-07-20T09:30:00Z" },
  ],
});

describe("parseRssXml", () => {
  it("normalizes valid items and skips malformed ones", async () => {
    const items = await parseRssXml(rssFixture);
    expect(items).toHaveLength(2); // no-date entry skipped
    expect(items[0]).toMatchObject({
      externalId: "https://example.com/prompt-caching",
      title: "Prompt caching explained",
      url: "https://example.com/prompt-caching",
      content: "How prompt caching cuts costs.",
    });
    expect(items[0].publishedAt.toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });

  it("caps content length", async () => {
    const items = await parseRssXml(rssFixture);
    const huge = items.find((i) => i.url === "https://example.com/huge");
    expect(huge?.content.length).toBe(MAX_CONTENT_LENGTH);
  });

  it("parses atom feeds (github releases)", async () => {
    const items = await parseRssXml(atomFixture);
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("tag:github.com,2008:Repository/1/v1.2.0");
    expect(items[0].title).toBe("v1.2.0");
  });
});

describe("parseHnJson", () => {
  it("normalizes hits, falls back to HN item URL, skips titleless hits", () => {
    const items = parseHnJson(hnFixture);
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe("https://example.com/agent-sdk");
    expect(items[1].url).toBe("https://news.ycombinator.com/item?id=41000002");
    expect(items[1].content).toContain("What do you use?");
  });
});
