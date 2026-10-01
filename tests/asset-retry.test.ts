import { afterEach, describe, expect, it, vi } from "vitest";
import { retryAsset } from "../apps/client/src/render/asset-retry";
afterEach(() => vi.useRealTimers());
describe("asset retry boundaries", () => {
  it("retries transient failures and returns the actual loaded asset", async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("model");
    const result = retryAsset(load, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toBe("model");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("stops after a bounded number of requests", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error("missing"));
    const result = expect(
      retryAsset(load, new AbortController().signal),
    ).rejects.toThrow("missing");
    await vi.runAllTimersAsync();
    await result;
    expect(load).toHaveBeenCalledTimes(4);
  });
  it("cancels pending retry timers when the scene is disposed", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const load = vi.fn().mockRejectedValue(new Error("offline"));
    const result = expect(retryAsset(load, controller.signal)).rejects.toThrow(
      "disposed",
    );
    await Promise.resolve();
    controller.abort(new Error("disposed"));
    await vi.runAllTimersAsync();
    await result;
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
