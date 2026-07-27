import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { applyTestDatabaseUrl } from "./src/test/databaseUrl";

// Make TEST_DATABASE_URL etc. available to integration tests (Node >= 20.12).
try {
  process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  // no .env present (e.g. CI) — unit tests still run; integration tests will fail loudly
}

// Point the run at TEST_DATABASE_URL and make the dev DATABASE_URL unreachable.
// Integration tests TRUNCATE every table, so this must happen before any test
// worker is forked. Throws rather than falling back — see src/test/databaseUrl.ts.
applyTestDatabaseUrl();

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Creates the test database if missing and applies every migration to it.
    globalSetup: ["./src/test/globalSetup.ts"],
    // Integration tests share one local Postgres — run test files sequentially.
    fileParallelism: false,
  },
});
