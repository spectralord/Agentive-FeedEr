import { NextResponse } from "next/server";
import { discardNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Route handler backing "Verwerfen" on /skills (T12.6): rejects a pending
 * SkillTagger proposal (hard delete — no "discarded" state in this schema).
 *
 * Param is named `slug` only to share the Next.js dynamic-path slot with
 * src/app/skills/[slug]/page.tsx (Epic 7) — the value is still the numeric
 * skill_nodes.id string, parsed below with Number(...).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const nodeId = Number(slug);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  await discardNode(nodeId);

  return NextResponse.redirect(new URL("/skills", request.url), 303);
}
