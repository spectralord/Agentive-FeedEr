import { NextResponse } from "next/server";
import { confirmNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route handler backing "Anlegen" on /skills (T12.6): confirms a pending
 * SkillTagger proposal as active. Plain HTML form POST + redirect, same
 * pattern as src/app/experience/[id]/lifecycle/route.ts.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const nodeId = Number(id);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const updated = await confirmNode(nodeId);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/skills", request.url), 303);
}
