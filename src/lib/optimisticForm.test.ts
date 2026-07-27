import { afterEach, describe, expect, it, vi } from "vitest";
import { submitFormOptimistic } from "./optimisticForm";

// T18.14 (§10.8): the shared POST helper every optimistic mutation call site
// uses. Hermetic — `fetch` is mocked, no network/DB touched, no ambient env
// dependency (see src/lib/admin/auth.test.ts for the project's established
// mocking convention this follows).
describe("submitFormOptimistic", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs the given FormData to the given action and returns true on an ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const formData = new FormData();
    formData.set("status", "tried");

    const ok = await submitFormOptimistic({ action: "/skills/x/progress", formData });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/skills/x/progress", { method: "POST", body: formData });
  });

  it("passes through a caller-supplied method instead of assuming POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await submitFormOptimistic({ action: "/x", method: "post", formData: new FormData() });

    expect(fetchMock).toHaveBeenCalledWith("/x", { method: "post", body: expect.any(FormData) });
  });

  it("returns false when the response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const ok = await submitFormOptimistic({ action: "/x", formData: new FormData() });
    expect(ok).toBe(false);
  });

  it("returns false (never throws) when fetch itself rejects, e.g. offline", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const ok = await submitFormOptimistic({ action: "/x", formData: new FormData() });
    expect(ok).toBe(false);
  });
});
