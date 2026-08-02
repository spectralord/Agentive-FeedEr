// Unit test of the route wrapper (T20.4 verification) — the actual mutation
// semantics (snapshot, refusal reasons, toggle) are covered by
// src/lib/actionables/index.integration.test.ts against real Postgres; this
// file only pins the HTTP shape: status codes, body parsing, and that the
// route is a thin pass-through to the one shared mutation (§8.4) rather than
// a second implementation.
import { describe, expect, it, vi } from "vitest";

const toggleActionableMock = vi.fn();
vi.mock("@/lib/actionables", () => ({ toggleActionable: toggleActionableMock }));

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/actionables/1/toggle", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/actionables/[reelId]/toggle", () => {
  it("400s on a non-numeric reelId without calling the mutation", async () => {
    const { POST } = await import("./route");
    const response = await POST(makeRequest(), { params: Promise.resolve({ reelId: "not-a-number" }) });
    expect(response.status).toBe(400);
    expect(toggleActionableMock).not.toHaveBeenCalled();
  });

  it("200s with state=completed and the snapshot on a fresh completion", async () => {
    toggleActionableMock.mockResolvedValue({
      ok: true,
      state: "completed",
      completion: {
        id: 1,
        reelId: 1,
        skillNodeId: 2,
        actionText: "Try it.",
        effortTag: "5-min-test",
        note: "Went fine.",
        doneAt: new Date("2026-08-01T00:00:00Z"),
      },
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest({ note: "Went fine." }), { params: Promise.resolve({ reelId: "1" }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      state: "completed",
      completion: { actionText: "Try it.", effortTag: "5-min-test", note: "Went fine." },
    });
    expect(toggleActionableMock).toHaveBeenCalledWith(1, "Went fine.");
  });

  it("200s with state=incomplete on untoggle, and tolerates a missing body", async () => {
    toggleActionableMock.mockResolvedValue({ ok: true, state: "incomplete" });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(), { params: Promise.resolve({ reelId: "1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "incomplete" });
    expect(toggleActionableMock).toHaveBeenCalledWith(1, undefined);
  });

  it("404s when the reel doesn't exist", async () => {
    toggleActionableMock.mockResolvedValue({ ok: false, reason: "not-found" });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(), { params: Promise.resolve({ reelId: "999" }) });

    expect(response.status).toBe(404);
  });

  it("422s (typed refusal, not a throw) when the reel has no action or no skill", async () => {
    toggleActionableMock.mockResolvedValue({ ok: false, reason: "no-action" });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(), { params: Promise.resolve({ reelId: "1" }) });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "no-action" });
  });
});
