// T21.5: unit test of the route's request validation and dispatch (set vs.
// reset), with the DB write functions mocked — the real DB round-trip is
// covered by map.integration.test.ts's setNodePositionBySlug/
// resetNodePositionBySlug tests. This test only pins the route's own
// contract: what shape of body maps to which lib call, and what an invalid
// body or unknown slug returns.
import { describe, expect, it, vi } from "vitest";

const setNodePositionBySlugMock = vi.fn();
const resetNodePositionBySlugMock = vi.fn();

vi.mock("@/lib/skills/map", () => ({
  setNodePositionBySlug: setNodePositionBySlugMock,
  resetNodePositionBySlug: resetNodePositionBySlugMock,
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/skills/sub-agents/position", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/skills/[slug]/position", () => {
  it("writes a manual override on {x, y} and returns the updated row", async () => {
    setNodePositionBySlugMock.mockResolvedValue({
      slug: "sub-agents",
      positionX: 123,
      positionY: 456,
      positionLocked: true,
    });
    const { POST } = await import("./route");

    const response = await POST(makeRequest({ x: 123, y: 456 }), {
      params: Promise.resolve({ slug: "sub-agents" }),
    });

    expect(response.status).toBe(200);
    expect(setNodePositionBySlugMock).toHaveBeenCalledWith("sub-agents", 123, 456);
    expect(resetNodePositionBySlugMock).not.toHaveBeenCalled();
    const body = (await response.json()) as { positionLocked: boolean };
    expect(body.positionLocked).toBe(true);
  });

  it("clears the override on {reset: true}", async () => {
    resetNodePositionBySlugMock.mockResolvedValue({
      slug: "sub-agents",
      positionX: null,
      positionY: null,
      positionLocked: false,
    });
    const { POST } = await import("./route");

    const response = await POST(makeRequest({ reset: true }), {
      params: Promise.resolve({ slug: "sub-agents" }),
    });

    expect(response.status).toBe(200);
    expect(resetNodePositionBySlugMock).toHaveBeenCalledWith("sub-agents");
    const body = (await response.json()) as { positionLocked: boolean };
    expect(body.positionLocked).toBe(false);
  });

  it("returns 400 for a body matching neither shape", async () => {
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ x: 10 }), { params: Promise.resolve({ slug: "sub-agents" }) });
    expect(response.status).toBe(400);
  });

  it("returns 400 for coordinates outside the abstract 0-1000 space", async () => {
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ x: -5, y: 2000 }), {
      params: Promise.resolve({ slug: "sub-agents" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/skills/sub-agents/position", {
      method: "POST",
      body: "not json",
    });
    const response = await POST(request, { params: Promise.resolve({ slug: "sub-agents" }) });
    expect(response.status).toBe(400);
  });

  it("returns 404 when the lib function reports an unknown/inactive slug", async () => {
    setNodePositionBySlugMock.mockResolvedValue(undefined);
    const { POST } = await import("./route");

    const response = await POST(makeRequest({ x: 1, y: 1 }), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });
});
