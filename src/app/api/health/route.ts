import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await db().execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return Response.json({ ok: true, db: dbOk });
}
