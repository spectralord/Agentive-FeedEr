import { NextResponse } from "next/server";
import { updateReport } from "@/lib/experienceReports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Route handler backing the plain HTML form at /experience/[id]/edit (T9.5).
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const important = form.get("important") === "1";

  if (!title || !body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const updated = await updateReport(reportId, { title, body, important });
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/experience", request.url), 303);
}
