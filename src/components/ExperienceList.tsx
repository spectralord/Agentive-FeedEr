import Link from "next/link";
import type { ExperienceReport } from "@/db/schema";
import { AUTHOR_TYPE_LABELS } from "@/lib/experienceReports";
import { formatRelativeTime } from "@/lib/relativeTime";

function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "amber";
}) {
  const cls =
    tone === "amber" ? "bg-amber-900/60 text-amber-200" : "bg-zinc-800 text-zinc-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

/**
 * `/experience` (T9.4): a compact chronological list of reports, clearly
 * separate from the Reel feed (ADR 0007) — plain text, no snap-scroll, no
 * sourced-content styling. Body is rendered as safely escaped
 * `whitespace-pre-wrap` preformatted text (T9.7): JSX text content is always
 * HTML-escaped by React, so this can never execute injected markup — no
 * markdown lib is available without a new dependency (documented deviation).
 */
export function ExperienceList({ reports }: { reports: ExperienceReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-zinc-400">
        Keine Berichte für diese Filterkombination.
      </p>
    );
  }

  return (
    <ol className="mx-auto flex max-w-xl flex-col divide-y divide-zinc-800/60 px-4 pb-16">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <time dateTime={report.createdAt.toISOString()}>
              {formatRelativeTime(report.createdAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{report.authorLabel}</span>
            <Badge>{AUTHOR_TYPE_LABELS[report.authorType]}</Badge>
            {report.important && <Badge>⭐ wichtig</Badge>}
            {report.lifecycleState === "deprecated" && <Badge tone="amber">⚠️ veraltet</Badge>}
            {report.lifecycleState === "archived" && <Badge>🗄️ archiviert</Badge>}
          </div>

          <Link
            href={`/experience/${report.id}/edit`}
            className="text-sm font-medium text-zinc-100 hover:underline"
          >
            {report.title}
          </Link>

          {report.lifecycleState !== "active" && report.lifecycleReason && (
            <p className="text-xs text-amber-300">
              Grund: {report.lifecycleReason}
              {report.supersededByReportId !== null && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`/experience/${report.supersededByReportId}/edit`}
                    className="underline"
                  >
                    ersetzt durch #{report.supersededByReportId}
                  </Link>
                </>
              )}
            </p>
          )}

          <p className="whitespace-pre-wrap text-sm text-zinc-300">{report.body}</p>
        </li>
      ))}
    </ol>
  );
}
