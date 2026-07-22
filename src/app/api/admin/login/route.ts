import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminEnabled, expectedSessionValue, verifyToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "admin disabled" }, { status: 503 });
  }
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const url = new URL(request.url);

  if (!verifyToken(token)) {
    return NextResponse.redirect(new URL("/admin/login?error=1", url.origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/admin", url.origin), { status: 303 });
  response.cookies.set(ADMIN_COOKIE, expectedSessionValue()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
