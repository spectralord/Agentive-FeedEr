import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Make DATABASE_URL etc. available to integration tests (Node >= 20.12).
try {
  process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  // no .env present (e.g. CI) — unit tests still run; integration tests will fail loudly
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Integration tests share one local Postgres — run test files sequentially.
    fileParallelism: false,
  },
});
