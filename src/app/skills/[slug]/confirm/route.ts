import { NextResponse } from "next/server";
import { confirmNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Route handler backing "Anlegen" on /skills (T12.6): confirms a pending
 * SkillTagger proposal as active. Plain HTML form POST + redirect, same
 * pattern as src/app/experience/[id]/lifecycle/route.ts.
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

  const updated = await confirmNode(nodeId);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/skills", request.url), 303);
}
