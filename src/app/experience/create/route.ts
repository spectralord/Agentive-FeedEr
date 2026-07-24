import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { createReport } from "@/lib/experienceReports";
import { env } from "@/lib/env";
import { resolveExecutionConfig } from "@/lib/executor/config";
import { getExecutor } from "@/lib/executor/executor";
import { tagSingle } from "@/lib/skilltagger/run";

// Route handler backing the plain HTML form at /experience/new (T9.5).
// author_type is always "own" here, author_label from OWNER_NAME (T9.2) —
// never taken from the request.
export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const important = form.get("important") === "1";

  if (!title || !body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const report = await createReport({
    title,
    body,
    authorType: "own",
    authorLabel: env().OWNER_NAME,
    important,
  });

  // Epic 12 (ADR 0009, T12.5): on-save tagging, fire-and-forget so the form
  // doesn't block on an LLM call. Same executor seam as the daily job
  // (getExecutor/resolveExecutionConfig); tagSingle never throws — a failure
  // here just leaves the report for the daily runSkillTagging backstop sweep.
  const executor = getExecutor(resolveExecutionConfig(env()));
  void tagSingle(db(), { type: "report", id: report.id }, executor).catch((error) => {
    console.error("[experience/create] tagSingle failed:", error);
  });

  return NextResponse.redirect(new URL("/experience", request.url), 303);
}
