"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExperienceReport } from "@/db/schema";
import { AUTHOR_TYPE_LABELS, type LifecycleState } from "@/lib/experienceReportTypes";
import { formatRelativeTime } from "@/lib/relativeTime";
import { submitFormOptimistic } from "@/lib/optimisticForm";

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

const actionButtonClass =
  "rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700";
const actionInputClass =
  "w-28 rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-500";

/**
 * `/experience` (T9.4, made optimistic T18.14 §10.8): one report row. Split
 * out of `ExperienceList.tsx` into its own `"use client"` component because
 * the lifecycle forms below need local, per-item state to update instantly
 * (badges, reason text, and the action-button set all depend on
 * `lifecycleState`) — `ExperienceList` itself stays a plain Server Component
 * mapping over reports.
 *
 * Every lifecycle form is still a plain `<form method="post"
 * action="/experience/[id]/lifecycle">` (T9.6, unchanged) — the same route +
 * `setLifecycleState` mutation, still the only write path. `onSubmit` only
 * attaches once JS hydrates; without it the form submits natively, same as
 * before.
 */
export function ExperienceReportItem({ report: initial }: { report: ExperienceReport }) {
  const [report, setReport] = useState(initial);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleLifecycleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const state = String(formData.get("state") ?? "") as LifecycleState;
    const reasonRaw = String(formData.get("reason") ?? "").trim();
    const supersededRaw = String(formData.get("supersededByReportId") ?? "").trim();
    const supersededByReportId = supersededRaw && Number.isInteger(Number(supersededRaw)) ? Number(supersededRaw) : null;

    const previous = report;
    setErrorText(null);
    setReport((r) => ({
      ...r,
      lifecycleState: state,
      lifecycleReason: reasonRaw || null,
      supersededByReportId,
    }));

    const ok = await submitFormOptimistic({ action: form.action, method: form.method, formData });
    if (!ok) {
      setReport(previous);
      setErrorText("Couldn't save — try again.");
    }
  }

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <time dateTime={report.createdAt.toISOString()}>{formatRelativeTime(report.createdAt)}</time>
        <span aria-hidden="true">·</span>
        <span>{report.authorLabel}</span>
        <Badge>{AUTHOR_TYPE_LABELS[report.authorType]}</Badge>
        {report.important && <Badge>⭐ important</Badge>}
        {report.lifecycleState === "deprecated" && <Badge tone="amber">⚠️ deprecated</Badge>}
        {report.lifecycleState === "archived" && <Badge>🗄️ archived</Badge>}
      </div>

      <Link href={`/experience/${report.id}/edit`} className="text-sm font-medium text-zinc-100 hover:underline">
        {report.title}
      </Link>

      {report.lifecycleState !== "active" && report.lifecycleReason && (
        <p className="text-xs text-amber-300">
          Reason: {report.lifecycleReason}
          {report.supersededByReportId !== null && (
            <>
              {" "}
              ·{" "}
              <Link href={`/experience/${report.supersededByReportId}/edit`} className="underline">
                superseded by #{report.supersededByReportId}
              </Link>
            </>
          )}
        </p>
      )}

      <p className="whitespace-pre-wrap text-sm text-zinc-300">{report.body}</p>

      <LifecycleActions report={report} onSubmit={handleLifecycleSubmit} />
      {/* Visible rollback (T18.14) — neutral brightness treatment, not
          --caution (ADR 0016: caveat/supersession only). */}
      {errorText && <p className="text-xs font-medium text-zinc-100">⚠ {errorText}</p>}
    </li>
  );
}

/**
 * Lifecycle transition forms (T9.6): plain `<form method="post">`s posting
 * to `/experience/[id]/lifecycle`, one per action — no client JS needed for
 * the mutation itself. `onSubmit` (T18.14) is the same one handler for every
 * form here; it reads whatever the user typed (`reason`/`supersededByReportId`)
 * straight out of the submitted `FormData`, so the optimistic update always
 * matches what was actually sent.
 */
function LifecycleActions({
  report,
  onSubmit,
}: {
  report: ExperienceReport;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (report.lifecycleState === "active") {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <form
          action={`/experience/${report.id}/lifecycle`}
          method="post"
          onSubmit={onSubmit}
          className="flex flex-wrap items-center gap-1"
        >
          <input type="hidden" name="state" value="deprecated" />
          <input type="text" name="reason" placeholder="Reason (optional)" className={actionInputClass} />
          <input
            type="number"
            name="supersededByReportId"
            placeholder="superseded by #"
            className={actionInputClass}
          />
          <button type="submit" className={actionButtonClass}>
            Mark as deprecated
          </button>
        </form>
        <form action={`/experience/${report.id}/lifecycle`} method="post" onSubmit={onSubmit}>
          <input type="hidden" name="state" value="archived" />
          <button type="submit" className={actionButtonClass}>
            Archive
          </button>
        </form>
      </div>
    );
  }

  if (report.lifecycleState === "deprecated") {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <form action={`/experience/${report.id}/lifecycle`} method="post" onSubmit={onSubmit}>
          <input type="hidden" name="state" value="active" />
          <button type="submit" className={actionButtonClass}>
            Reactivate
          </button>
        </form>
        <form action={`/experience/${report.id}/lifecycle`} method="post" onSubmit={onSubmit}>
          <input type="hidden" name="state" value="archived" />
          <button type="submit" className={actionButtonClass}>
            Archive
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <form action={`/experience/${report.id}/lifecycle`} method="post" onSubmit={onSubmit}>
        <input type="hidden" name="state" value="active" />
        <button type="submit" className={actionButtonClass}>
          Reactivate
        </button>
      </form>
    </div>
  );
}
