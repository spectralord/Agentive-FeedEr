import { redirect } from "next/navigation";
import { and, count, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { rawItems, reels, type PipelineRun } from "@/db/schema";
import { adminEnabled, isAuthed } from "@/lib/admin/auth";
import { env } from "@/lib/env";
import { recentRuns } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams: Promise<{ started?: string; busy?: string }>;
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
  if (!run.finishedAt) return "läuft…";
  const ms = run.finishedAt.getTime() - run.startedAt.getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function runSummary(run: PipelineRun): string {
  const s = (run.summary ?? {}) as {
    ingestion?: { totalInserted: number; perSource: { name: string; error?: string }[] };
    enrichment?: { processed: number; succeeded: number; failed: number };
    skillTagging?: { processed: number; matched: number; proposed: number; failed: number };
    feedback?: { ran: boolean; newInteractions: number; bulletCount?: number };
  };
  const parts: string[] = [];
  if (s.ingestion) {
    const failed = s.ingestion.perSource.filter((p) => p.error).map((p) => p.name);
    parts.push(`+${s.ingestion.totalInserted} Items${failed.length ? ` · Quellen-Fehler: ${failed.join(", ")}` : ""}`);
  }
  if (s.enrichment) parts.push(`Enrich ${s.enrichment.succeeded}✓/${s.enrichment.failed}✗`);
  if (s.skillTagging) {
    parts.push(
      `Skills ${s.skillTagging.matched} Match/${s.skillTagging.proposed} Vorschlag${s.skillTagging.failed ? `/${s.skillTagging.failed}✗` : ""}`,
    );
  }
  if (s.feedback?.ran) parts.push(`Feedback-Summary aktualisiert (${s.feedback.bulletCount} Punkte)`);
  if (run.error) parts.push(`Fehler: ${run.error}`);
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

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!adminEnabled()) redirect("/admin/login");
  if (!(await isAuthed())) redirect("/admin/login");

  const { started, busy } = await searchParams;
  const stats = await loadStats();
  const runs = await recentRuns(db());
  const keySet = Boolean(env().ANTHROPIC_API_KEY);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <form method="post" action="/api/admin/logout">
          <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">Abmelden</button>
        </form>
      </div>

      {started && <p className="mb-3 text-sm text-emerald-300">Lauf #{started} gestartet.</p>}
      {busy && <p className="mb-3 text-sm text-amber-300">Es läuft bereits ein Durchlauf — bitte warten.</p>}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">System</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Raw Items" value={String(stats.rawTotal)} />
          <Tile label="Reels" value={String(stats.reelTotal)} />
          <Tile label="Unangereichert" value={String(stats.unenriched)} />
          <Tile label="Enrich-Fehler" value={String(stats.errored)} warn={stats.errored > 0} />
          <Tile label="ANTHROPIC_API_KEY" value={keySet ? "gesetzt" : "fehlt"} warn={!keySet} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Pipeline ausführen</h2>
        <div className="flex flex-wrap gap-2">
          <RunButton mode="full" label="Voll ausführen" />
          <RunButton mode="ingestion" label="Nur Ingestion" />
          <RunButton mode="enrichment" label="Nur Enrichment" />
        </div>
        {!keySet && (
          <p className="mt-2 text-xs text-amber-300">
            Ohne <code className="font-mono">ANTHROPIC_API_KEY</code> läuft nur Ingestion sinnvoll; Enrichment schlägt fehl.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Letzte Läufe</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">Noch keine Läufe.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li key={run.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={STATUS_COLOR[run.status]}>
                    #{run.id} {run.status} · {run.trigger}/{run.mode}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {run.startedAt.toLocaleString("de-DE")} · {fmtDuration(run)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{runSummary(run)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
