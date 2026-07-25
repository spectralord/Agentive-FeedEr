import { notFound } from "next/navigation";
import { SkillNodeDetail } from "@/components/SkillNodeDetail";
import { getNodeDetail } from "@/lib/skills/map";
import { isDisplayStatus } from "@/lib/skills/progress";

// Status/notes/associated content all change independently of any build —
// never a frozen snapshot (same reasoning as /experience/[id]/edit).
export const dynamic = "force-dynamic";

interface SkillNodePageProps {
  params: Promise<{ slug: string }>;
  // T18.5: `?from=<status>` is set by the progress route handler's redirect
  // only when the status actually changed — drives SkillRing's one-time
  // fill animation. Validated before use so an arbitrary/stale query value
  // can never fake a transition.
  searchParams: Promise<{ from?: string }>;
}

/** `/skills/[slug]` (T7.3): one skill node's detail view. */
export default async function SkillNodePage({ params, searchParams }: SkillNodePageProps) {
  const { slug } = await params;
  const { from } = await searchParams;
  const detail = await getNodeDetail(slug);

  if (!detail) {
    notFound();
  }

  const previousStatus = from && isDisplayStatus(from) && from !== detail.status ? from : undefined;

  return <SkillNodeDetail detail={detail} previousStatus={previousStatus} />;
}
