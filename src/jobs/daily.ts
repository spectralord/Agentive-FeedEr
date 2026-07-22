// Daily pipeline entrypoint — run via `npm run job:daily` (Railway cron or locally).
// Phase 1: ingestion (cheap, no AI). Phase 2: enrichment (added in Epic 2).
import { db, getPool } from "@/db/client";
import { runIngestion } from "@/lib/ingestion/run";

async function main(): Promise<number> {
  console.log(`[daily] starting at ${new Date().toISOString()}`);

  const ingestion = await runIngestion(db());
  for (const s of ingestion.perSource) {
    const status = s.error ? `ERROR: ${s.error}` : `fetched ${s.fetched}, inserted ${s.inserted}`;
    console.log(`[ingestion] ${s.name}: ${status}`);
  }
  console.log(`[ingestion] total inserted: ${ingestion.totalInserted}`);

  // TODO(epic-2): const enrichment = await runEnrichment(db());

  const allFailed =
    ingestion.perSource.length > 0 && ingestion.perSource.every((s) => s.error);
  return allFailed ? 1 : 0;
}

main()
  .then(async (code) => {
    await getPool().end();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error("[daily] fatal:", error);
    await getPool().end();
    process.exit(1);
  });
