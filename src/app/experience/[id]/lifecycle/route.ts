import { NextResponse } from "next/server";
import { LIFECYCLE_STATES, setLifecycleState, type LifecycleState } from "@/lib/experienceReports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isLifecycleState(value: string): value is LifecycleState {
  return (LIFECYCLE_STATES as readonly string[]).includes(value);
}

/**
 * Route handler backing the lifecycle action forms on `/experience` (T9.6):
 * deprecate (with optional reason + superseded_by_report_id), archive,
 * reactivate. Separate from the hard-delete escape hatch (ADR 0008), which
 * this route never performs.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const form = await request.formData();
  const state = String(form.get("state") ?? "");
  if (!isLifecycleState(state)) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  const reasonRaw = String(form.get("reason") ?? "").trim();
  const supersededRaw = String(form.get("supersededByReportId") ?? "").trim();
  const supersededByReportId = supersededRaw ? Number(supersededRaw) : undefined;

  const updated = await setLifecycleState(reportId, state, {
    reason: reasonRaw || undefined,
    supersededByReportId:
      supersededByReportId !== undefined && Number.isInteger(supersededByReportId)
        ? supersededByReportId
        : undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL("/experience", request.url), 303);
}
