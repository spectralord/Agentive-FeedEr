import { NextResponse } from "next/server";
import { discardNode } from "@/lib/skilltagger/nodes";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route handler backing "Verwerfen" on /skills (T12.6): rejects a pending
 * SkillTagger proposal (hard delete — no "discarded" state in this schema).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const nodeId = Number(id);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  await discardNode(nodeId);

  return NextResponse.redirect(new URL("/skills", request.url), 303);
}
