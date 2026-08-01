import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdoptionLogEntry } from "@/lib/skills/progress";
import { AdoptionLog } from "./AdoptionLog";

const entries: AdoptionLogEntry[] = [
  {
    source: "progress",
    id: 2,
    skillNodeId: 1,
    status: "mastered",
    note: "Rolled prompt caching out everywhere.",
    createdAt: new Date("2026-07-22T00:00:00Z"),
    nodeSlug: "prompt-caching",
    nodeTitle: "Prompt Caching",
  },
  {
    source: "progress",
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

  // Epic 20 (T20.5, ADR 0019 decision 4): the second source.
  it("renders a completed-Actionable entry with the snapshotted action text and a 'done' badge, not a status", () => {
    const html = renderToStaticMarkup(
      <AdoptionLog
        entries={[
          {
            source: "actionable",
            id: 5,
            skillNodeId: 3,
            actionText: "Add cache_control to your longest static prompt block.",
            note: "Cut latency noticeably.",
            createdAt: new Date("2026-07-25T00:00:00Z"),
            nodeSlug: "prompt-caching",
            nodeTitle: "Prompt Caching",
          },
        ]}
      />,
    );
    expect(html).toContain("Add cache_control to your longest static prompt block.");
    expect(html).toContain("Cut latency noticeably.");
    expect(html).toContain(">done<");
    // Never a declared-status word for this source.
    expect(html).not.toContain(">seen<");
    expect(html).not.toContain(">tried<");
    expect(html).not.toContain(">mastered<");
  });

  it("renders mixed-source entries in the given interleaved order without conflating them", () => {
    const html = renderToStaticMarkup(
      <AdoptionLog
        entries={[
          {
            source: "actionable",
            id: 5,
            skillNodeId: 3,
            actionText: "Add cache_control to your longest static prompt block.",
            note: "Newest first.",
            createdAt: new Date("2026-07-25T00:00:00Z"),
            nodeSlug: "prompt-caching",
            nodeTitle: "Prompt Caching",
          },
          entries[0],
        ]}
      />,
    );
    const actionableIdx = html.indexOf("Newest first.");
    const progressIdx = html.indexOf("Rolled prompt caching out everywhere.");
    expect(actionableIdx).toBeGreaterThan(-1);
    expect(progressIdx).toBeGreaterThan(actionableIdx);
  });
});
