import { NextResponse } from "next/server";
import { createReport } from "@/lib/experienceReports";
import { env } from "@/lib/env";

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

  await createReport({
    title,
    body,
    authorType: "own",
    authorLabel: env().OWNER_NAME,
    important,
  });

  return NextResponse.redirect(new URL("/experience", request.url), 303);
}
