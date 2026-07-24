import { notFound } from "next/navigation";
import { CONFIDENCE_LABELS } from "@/components/labels";
import { getClusterWithMembers } from "@/lib/clusters";
import { formatRelativeTime } from "@/lib/relativeTime";

interface PageParams {
  params: Promise<{ id: string }>;
}

// Confidence/lifecycle state can change on every pipeline run — never a
// frozen build-time snapshot (same reasoning as /overview, /skills).
export const dynamic = "force-dynamic";

/**
 * Minimal topic-cluster detail page (T11.5): every member reel of the
 * cluster, its confidence badge, and — if applicable — the supersession
 * notice with a "Confirm superseded" action. This is the link target for
 * the "🕓 Newer available" notice on a reel card (src/components/ReelCard.tsx).
 */
export default async function ClusterPage({ params }: PageParams) {
  const { id } = await params;
  const clusterId = Number(id);
  if (!Number.isInteger(clusterId)) notFound();

  const data = await getClusterWithMembers(clusterId);
  if (!data) notFound();
  const { cluster, members } = data;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-zinc-100">{cluster.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5">
          {members.length} source{members.length === 1 ? "" : "s"}
        </span>
        {cluster.confidence && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5">
            🔎 {CONFIDENCE_LABELS[cluster.confidence as "few" | "some" | "strong"]}
          </span>
        )}
        {cluster.lifecycleState === "deprecated" && (
          <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-amber-300">Deprecated</span>
        )}
      </div>

      {cluster.supersededByClusterId !== null && cluster.lifecycleState === "active" && (
        <div className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
          <p className="text-sm text-amber-200">
            🕓 Newer available{cluster.supersedeReason ? `: ${cluster.supersedeReason}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <a
              href={`/clusters/${cluster.supersededByClusterId}`}
              className="text-xs underline decoration-amber-700 underline-offset-2 hover:text-amber-100"
            >
              View newer cluster
            </a>
            <form method="post" action={`/clusters/${cluster.id}/deprecate`}>
              <button
                type="submit"
                className="rounded-full border border-amber-700 px-3 py-1 text-xs text-amber-200 transition-colors hover:bg-amber-900/40"
              >
                Confirm superseded
              </button>
            </form>
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {members.map((member) => (
          <li key={member.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
            <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-300">{member.sourceName}</span>
              <time dateTime={member.publishedAt.toISOString()}>{formatRelativeTime(member.publishedAt)}</time>
            </div>
            <a
              href={member.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm text-zinc-100 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300"
            >
              {member.title}
            </a>
            {member.isPrimary === true && <span className="mt-1 block text-[11px] text-zinc-500">Primary source</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
