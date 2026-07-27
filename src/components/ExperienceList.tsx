import type { ExperienceReport } from "@/db/schema";
import { EmptyState } from "./EmptyState";
import { ExperienceReportItem } from "./ExperienceReportItem";

/**
 * `/experience` (T9.4): a compact chronological list of reports, clearly
 * separate from the Reel feed (ADR 0007) — plain text, no snap-scroll, no
 * sourced-content styling. Body is rendered as safely escaped
 * `whitespace-pre-wrap` preformatted text (T9.7): JSX text content is always
 * HTML-escaped by React, so this can never execute injected markup — no
 * markdown lib is available without a new dependency (documented deviation).
 *
 * Stays a plain Server Component; each row is `ExperienceReportItem.tsx`
 * (T18.14, §10.8) — a `"use client"` component owning the optimistic
 * lifecycle state for that one report.
 */
export function ExperienceList({ reports }: { reports: ExperienceReport[] }) {
  // T18.12 (§10.7): routed through the shared EmptyState component.
  if (reports.length === 0) {
    return <EmptyState variant="inline" title="No reports for this filter combination." />;
  }

  return (
    <ol className="mx-auto flex max-w-xl flex-col divide-y divide-zinc-800/60 px-4 pb-16">
      {reports.map((report) => (
        <ExperienceReportItem key={report.id} report={report} />
      ))}
    </ol>
  );
}
