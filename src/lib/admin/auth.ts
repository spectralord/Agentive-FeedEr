import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const ADMIN_COOKIE = "admin_session";

/** Admin is only enabled when ADMIN_TOKEN is set (safe default on a public URL). */
export function adminEnabled(): boolean {
  return Boolean(env().ADMIN_TOKEN);
}

/** Cookie value = HMAC(fixed message) keyed by the token — the raw token is never
 *  stored in the cookie, and the value can't be forged without the token. */
export function sessionValueForToken(token: string): string {
  return createHmac("sha256", token).update("agentive-feeder-admin-v1").digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verifies a submitted token against ADMIN_TOKEN (constant-time). */
export function verifyToken(input: string, token = env().ADMIN_TOKEN): boolean {
  if (!token) return false;
  return constantTimeEqual(input, token);
}

/** The cookie value a valid session must carry, or null if admin is disabled. */
export function expectedSessionValue(token = env().ADMIN_TOKEN): string | null {
  return token ? sessionValueForToken(token) : null;
}

/** True if the current request carries a valid admin session cookie. */
export async function isAuthed(): Promise<boolean> {
  const expected = expectedSessionValue();
  if (!expected) return false;
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  return constantTimeEqual(cookie, expected);
}
