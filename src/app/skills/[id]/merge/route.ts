import { NextResponse } from "next/server";
import { mergeNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route handler backing "Mergen" on /skills (T12.6): folds a pending
 * SkillTagger proposal into an existing active node (chosen via the form's
 * target-slug select) instead of creating a new one.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const nodeId = Number(id);
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
