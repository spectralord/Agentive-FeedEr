import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdoptionLogEntry } from "@/lib/skills/progress";
import { AdoptionLog } from "./AdoptionLog";

const entries: AdoptionLogEntry[] = [
  {
    id: 2,
    skillNodeId: 1,
    status: "mastered",
    note: "Rolled prompt caching out everywhere.",
    createdAt: new Date("2026-07-22T00:00:00Z"),
    nodeSlug: "prompt-caching",
    nodeTitle: "Prompt Caching",
  },
  {
    id: 1,
    skillNodeId: 2,
    status: "tried",
    note: "Tried the sub-agent pattern.",
    createdAt: new Date("2026-07-19T00:00:00Z"),
    nodeSlug: "sub-agents",
    nodeTitle: "Sub-Agents",
  },
];

describe("AdoptionLog", () => {
  it("renders each entry's node title, status, and note text, linking to the node", () => {
    const html = renderToStaticMarkup(<AdoptionLog entries={entries} />);
    expect(html).toContain("Prompt Caching");
    expect(html).toContain("Rolled prompt caching out everywhere.");
    expect(html).toContain('href="/skills/prompt-caching"');
    expect(html).toContain("Sub-Agents");
    expect(html).toContain("Tried the sub-agent pattern.");
  });

  it("preserves the given (caller-controlled) order rather than re-sorting", () => {
    const html = renderToStaticMarkup(<AdoptionLog entries={entries} />);
    const firstIdx = html.indexOf("Rolled prompt caching out everywhere.");
    const secondIdx = html.indexOf("Tried the sub-agent pattern.");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("shows an empty state for no entries", () => {
    const html = renderToStaticMarkup(<AdoptionLog entries={[]} />);
    expect(html).toContain("No adopted notes yet.");
  });
});
