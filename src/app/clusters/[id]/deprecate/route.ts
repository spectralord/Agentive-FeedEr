import { NextResponse } from "next/server";
import { deprecateCluster } from "@/lib/clusters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route handler backing "Confirm superseded" on a reel/cluster whose
 * lifecycle_state is still `active` but has a freshness-pass supersession
 * proposal (T11.5): sets lifecycle_state = 'deprecated' for real. Plain HTML
 * form POST + redirect, same pattern as
 * src/app/skills/[slug]/confirm/route.ts.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const clusterId = Number(id);
  if (!Number.isInteger(clusterId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const updated = await deprecateCluster(clusterId);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(`/clusters/${clusterId}`, request.url), 303);
}
