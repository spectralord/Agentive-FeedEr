// T19.5 (ADR 0024 decision 3): pins that the route itself — not just the
// button-hiding boolean in ReelDetail — refuses to run under the `api`
// executor. This is the "and this is a real limitation, not an oversight"
// guard: even if a future change bypassed the hidden button, the route
// still returns 503 and never touches the model or the DB. No real
// Postgres/CLI involved — `@/db/client` and `@/lib/executor/executor` are
// both mocked so this is a pure unit test of the guard branch.
import { describe, expect, it, vi } from "vitest";

const dbMock = vi.fn();
const getExecutorMock = vi.fn();
const runWriteupForReelMock = vi.fn();

vi.mock("@/db/client", () => ({ db: dbMock }));
vi.mock("@/lib/executor/executor", () => ({ getExecutor: getExecutorMock }));
vi.mock("@/lib/writeup/run", () => ({ runWriteupForReel: runWriteupForReelMock }));

function makeRequest() {
  return new Request("http://localhost/api/reels/1/writeup", { method: "POST" });
}

describe("POST /api/reels/[id]/writeup — cloud guard (ADR 0024 decision 3)", () => {
  it("returns 503 and never calls the executor/DB when the resolved executor is api", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ DATABASE_URL: "postgres://localhost/test", APP_PROFILE: "cloud" }),
    }));
    const { POST } = await import("./route");

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "1" }) });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/claude-code/);
    expect(getExecutorMock).not.toHaveBeenCalled();
    expect(runWriteupForReelMock).not.toHaveBeenCalled();
    expect(dbMock).not.toHaveBeenCalled();

    vi.doUnmock("@/lib/env");
  });

  it("proceeds to the executor/runner when the resolved executor is claude-code (local)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ DATABASE_URL: "postgres://localhost/test", APP_PROFILE: "local" }),
    }));
    getExecutorMock.mockReturnValue("fake-executor");
    runWriteupForReelMock.mockResolvedValue({ status: "generated" });
    dbMock.mockReturnValue("fake-db");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "1" }) });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("generated");
    expect(runWriteupForReelMock).toHaveBeenCalledWith("fake-db", 1, "fake-executor");

    vi.doUnmock("@/lib/env");
  });
});
