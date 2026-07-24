import { redirect } from "next/navigation";
import { and, count, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { rawItems, reels, type PipelineRun } from "@/db/schema";
import { adminEnabled, isAuthed } from "@/lib/admin/auth";
import { listSourcesWithErrorCounts } from "@/lib/admin/sources";
import { env } from "@/lib/env";
import { recentRuns } from "@/lib/pipeline";
import { formatRelativeTime } from "@/lib/relativeTime";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams: Promise<{ started?: string; busy?: string; retried?: string }>;
}

async function loadStats() {
  const [{ v: rawTotal }] = await db().select({ v: count() }).from(rawItems);
  const [{ v: reelTotal }] = await db().select({ v: count() }).from(reels);
  const [{ v: unenriched }] = await db()
    .select({ v: count() })
    .from(rawItems)
    .where(and(isNull(rawItems.enrichedAt), isNull(rawItems.enrichError)));
  const [{ v: errored }] = await db()
    .select({ v: count() })
    .from(rawItems)
    .where(isNotNull(rawItems.enrichError));
  return { rawTotal, reelTotal, unenriched, errored };
}

function fmtDuration(run: PipelineRun): string {
  if (!run.finishedAt) return "running…";
  const ms = run.finishedAt.getTime() - run.startedAt.getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function runSummary(run: PipelineRun): string {
  const s = (run.summary ?? {}) as {
    ingestion?: { totalInserted: number; perSource: { name: string; error?: string }[] };
    enrichment?: { processed: number; succeeded: number; failed: number };
    skillTagging?: { processed: number; matched: number; proposed: number; failed: number };
    clustering?: { processed: number; matched: number; proposed: number; failed: number };
    knowledgeCheck?: {
      confidence: unknown[];
      freshness: { groupsChecked: number; supersededFound: number; failed: number } | null;
    };
    feedback?: { ran: boolean; newInteractions: number; bulletCount?: number };
  };
  const parts: string[] = [];
  if (s.ingestion) {
    const failed = s.ingestion.perSource.filter((p) => p.error).map((p) => p.name);
    parts.push(`+${s.ingestion.totalInserted} items${failed.length ? ` · source errors: ${failed.join(", ")}` : ""}`);
  }
  if (s.enrichment) parts.push(`Enrich ${s.enrichment.succeeded}✓/${s.enrichment.failed}✗`);
  if (s.skillTagging) {
    parts.push(
      `Skills ${s.skillTagging.matched} match/${s.skillTagging.proposed} proposed${s.skillTagging.failed ? `/${s.skillTagging.failed}✗` : ""}`,
    );
  }
  if (s.clustering) {
    parts.push(
      `Clusters ${s.clustering.matched} match/${s.clustering.proposed} proposed${s.clustering.failed ? `/${s.clustering.failed}✗` : ""}`,
    );
  }
  if (s.knowledgeCheck) {
    const f = s.knowledgeCheck.freshness;
    parts.push(
      `Knowledge check: ${s.knowledgeCheck.confidence.length} clusters scored${f ? ` · freshness ${f.supersededFound} superseded${f.failed ? `/${f.failed}✗` : ""}` : ""}`,
    );
  }
  if (s.feedback?.ran) parts.push(`Feedback summary updated (${s.feedback.bulletCount} bullets)`);
  if (run.error) parts.push(`Error: ${run.error}`);
  return parts.join(" · ") || "—";
}

const STATUS_COLOR: Record<PipelineRun["status"], string> = {
  running: "text-amber-300",
  success: "text-emerald-300",
  failed: "text-red-400",
};

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-sm font-medium ${warn ? "text-amber-300" : "text-zinc-100"}`}>{value}</div>
    </div>
  );
}

function RunButton({ mode, label }: { mode: string; label: string }) {
  return (
    <form method="post" action="/api/admin/run">
      <input type="hidden" name="mode" value={mode} />
      <button
        type="submit"
        className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        {label}
      </button>
    </form>
  );
}

function RetryButton({ sourceId }: { sourceId: number }) {
  return (
    <form method="post" action={`/api/admin/sources/${sourceId}/retry`}>
      <button
        type="submit"
        className="rounded-full border border-amber-700 px-2 py-1 text-xs text-amber-200 transition-colors hover:bg-amber-900/40"
      >
        Reset enrich errors
      </button>
    </form>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!adminEnabled()) redirect("/admin/login");
  if (!(await isAuthed())) redirect("/admin/login");

  const { started, busy, retried } = await searchParams;
  const stats = await loadStats();
  const runs = await recentRuns(db());
  const sourcesList = await listSourcesWithErrorCounts(db());
  const keySet = Boolean(env().ANTHROPIC_API_KEY);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <form method="post" action="/api/admin/logout">
          <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">Log out</button>
        </form>
      </div>

      {started && <p className="mb-3 text-sm text-emerald-300">Run #{started} started.</p>}
      {busy && <p className="mb-3 text-sm text-amber-300">A run is already in progress — please wait.</p>}
      {retried !== undefined && (
        <p className="mb-3 text-sm text-emerald-300">Cleared {retried} enrich error(s) — will retry next run.</p>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">System</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Raw Items" value={String(stats.rawTotal)} />
          <Tile label="Reels" value={String(stats.reelTotal)} />
          <Tile label="Unenriched" value={String(stats.unenriched)} />
          <Tile label="Enrich errors" value={String(stats.errored)} warn={stats.errored > 0} />
          <Tile label="ANTHROPIC_API_KEY" value={keySet ? "set" : "missing"} warn={!keySet} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Run pipeline</h2>
        <div className="flex flex-wrap gap-2">
          <RunButton mode="full" label="Run full" />
          <RunButton mode="ingestion" label="Ingestion only" />
          <RunButton mode="enrichment" label="Enrichment only" />
        </div>
        {!keySet && (
          <p className="mt-2 text-xs text-amber-300">
            Without <code className="font-mono">ANTHROPIC_API_KEY</code> only ingestion is useful; enrichment fails.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={STATUS_COLOR[run.status]}>
                    #{run.id} {run.status} · {run.trigger}/{run.mode}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {run.startedAt.toLocaleString("en-GB")} · {fmtDuration(run)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{runSummary(run)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Sources</h2>
        {sourcesList.length === 0 ? (
          <p className="text-sm text-zinc-500">No sources configured.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sourcesList.map((source) => (
              <li key={source.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-100">
                    {source.name} <span className="text-xs text-zinc-500">({source.type})</span>
                  </span>
                  <span className={`text-xs ${source.enabled ? "text-emerald-300" : "text-zinc-500"}`}>
                    {source.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    Last polled: {source.lastPolledAt ? formatRelativeTime(source.lastPolledAt) : "never"}
                    {source.enrichErrorCount > 0 && (
                      <span className="ml-2 text-amber-300">{source.enrichErrorCount} enrich error(s)</span>
                    )}
                  </span>
                  {source.enrichErrorCount > 0 && <RetryButton sourceId={source.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
