import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { adminEnabled, isAuthed } from "@/lib/admin/auth";
import { beginRun, PipelineBusyError, runAndFinish, type PipelineMode } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const MODES: PipelineMode[] = ["full", "ingestion", "enrichment"];

export async function POST(request: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin disabled" }, { status: 503 });
  }
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const mode = String(form.get("mode") ?? "full") as PipelineMode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }
  const url = new URL(request.url);

  let runId: number;
  try {
    // Reserve the run synchronously (guards against a concurrent run)...
    runId = await beginRun(db(), "manual", mode);
  } catch (error) {
    if (error instanceof PipelineBusyError) {
      return NextResponse.redirect(new URL("/admin?busy=1", url.origin), { status: 303 });
    }
    throw error;
  }

  // ...then run it fire-and-forget in the always-on container (ADR 0006/0010).
  void runAndFinish(db(), runId, mode);

  return NextResponse.redirect(new URL(`/admin?started=${runId}`, url.origin), { status: 303 });
}
