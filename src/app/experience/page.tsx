import Link from "next/link";
import {
  ExperienceFilterBar,
  type ExperienceFilterState,
} from "@/components/ExperienceFilterBar";
import { ExperienceList } from "@/components/ExperienceList";
import { listReports, type LifecycleState } from "@/lib/experienceReports";

// Own/curated experience reports are a separate content type from Reels
// (ADR 0007) with their own lifecycle (ADR 0008) — this list must be
// recomputed per request from searchParams + current DB state, never frozen
// as a single static build-time snapshot (same reasoning as /overview).
export const dynamic = "force-dynamic";

export type ExperienceSearchParams = ExperienceFilterState;

const FETCH_LIMIT = 500;

interface ExperiencePageProps {
  searchParams: Promise<ExperienceSearchParams>;
}

export default async function ExperiencePage({ searchParams }: ExperiencePageProps) {
  const params = await searchParams;

  const states: LifecycleState[] = ["active"];
  if (params.deprecated === "1") states.push("deprecated");
  if (params.archived === "1") states.push("archived");

  const reports = await listReports({
    authorType: params.authorType,
    states,
    limit: FETCH_LIMIT,
  });

  return (
    <div className="pb-16">
      <div className="mx-auto max-w-xl px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">📓 Erfahrung</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Gelebte Erfahrung, keine verifizierten News — getrennt vom Reel-Feed.
            </p>
          </div>
          <Link
            href="/experience/new"
            className="shrink-0 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
          >
            + Neuer Bericht
          </Link>
        </div>
      </div>
      <ExperienceFilterBar current={params} />
      <ExperienceList reports={reports} />
    </div>
  );
}
