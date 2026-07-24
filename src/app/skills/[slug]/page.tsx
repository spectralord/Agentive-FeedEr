import { notFound } from "next/navigation";
import { SkillNodeDetail } from "@/components/SkillNodeDetail";
import { getNodeDetail } from "@/lib/skills/map";

// Status/notes/associated content all change independently of any build —
// never a frozen snapshot (same reasoning as /experience/[id]/edit).
export const dynamic = "force-dynamic";

interface SkillNodePageProps {
  params: Promise<{ slug: string }>;
}

/** `/skills/[slug]` (T7.3): one skill node's detail view. */
export default async function SkillNodePage({ params }: SkillNodePageProps) {
  const { slug } = await params;
  const detail = await getNodeDetail(slug);

  if (!detail) {
    notFound();
  }

  return <SkillNodeDetail detail={detail} />;
}
