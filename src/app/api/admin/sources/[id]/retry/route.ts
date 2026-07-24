import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { adminEnabled, isAuthed } from "@/lib/admin/auth";
import { resetEnrichErrors } from "@/lib/admin/sources";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * T13.7: "Reset enrich errors" action for a single source — same admin-guard
 * + POST + redirect-to-/admin pattern as src/app/api/admin/run/route.ts.
 */
export async function POST(request: Request, { params }: RouteParams) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin disabled" }, { status: 503 });
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isInteger(sourceId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const cleared = await resetEnrichErrors(db(), sourceId);
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/admin?retried=${cleared}`, url.origin), { status: 303 });
}
