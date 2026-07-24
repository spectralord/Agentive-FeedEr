import { NextResponse } from "next/server";
import { mergeNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Route handler backing "Mergen" on /skills (T12.6): folds a pending
 * SkillTagger proposal into an existing active node (chosen via the form's
 * target-slug select) instead of creating a new one.
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

  const form = await request.formData();
  const targetSlug = String(form.get("targetSlug") ?? "").trim();
  if (!targetSlug) {
    return NextResponse.json({ error: "targetSlug is required" }, { status: 400 });
  }

  await mergeNode(nodeId, targetSlug);

  return NextResponse.redirect(new URL("/skills", request.url), 303);
}
