import { NextResponse } from "next/server";
import { removeInteraction } from "@/lib/interactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Route handler backing the "Entfernen" button on /saved (T6.3): retracts the
 * save (idempotent — no-op if already gone). Plain HTML form POST + redirect,
 * same pattern as src/app/experience/[id]/lifecycle/route.ts.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const reelId = Number(id);
  if (!Number.isInteger(reelId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  await removeInteraction(reelId, "save");

  return NextResponse.redirect(new URL("/saved", request.url), 303);
}
