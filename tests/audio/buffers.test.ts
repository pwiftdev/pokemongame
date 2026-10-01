import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioBuffers } from "../../apps/client/src/audio/buffers";
import { Context, buffer, setupAudio } from "./fakes";
beforeEach(setupAudio);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("audio buffer lifetime", () => {
  it("deduplicates in-flight downloads and evicts decoded samples at the byte limit", async () => {
    const context = new Context();
    context.decodeAudioData.mockImplementation(async () => buffer(4));
    const cache = new AudioBuffers(context.asAudio(), 16);
    await Promise.all([cache.get("ui"), cache.get("ui")]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await cache.get("hit-0");
    expect(cache.metrics).toMatchObject({ bytes: 16, cached: 1, pending: 0 });
    await cache.get("ui");
    expect(fetch).toHaveBeenCalledTimes(3);
    cache.dispose();
  });
  it("does not retain a decode that finishes after disposal", async () => {
    const context = new Context();
    let finish!: (value: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const cache = new AudioBuffers(context.asAudio());
    const pending = expect(cache.get("ui")).rejects.toThrow();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    cache.dispose();
    finish(buffer());
    await pending;
    expect(cache.metrics).toMatchObject({ bytes: 0, cached: 0, pending: 0 });
  });
  it("bounds failed fetch attempts and allows a later recovery", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const cache = new AudioBuffers(new Context().asAudio());
    const failed = expect(cache.get("ui")).rejects.toThrow("offline");
    await vi.runAllTimersAsync();
    await failed;
    expect(fetch).toHaveBeenCalledTimes(3);
    await expect(cache.get("ui")).rejects.toThrow("unavailable");
    expect(fetch).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(15001);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    } as Response);
    await expect(cache.get("ui")).resolves.toBeDefined();
    cache.dispose();
  });
  it("allows at most four simultaneous sample requests", async () => {
    const releases: Array<() => void> = [];
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() =>
            resolve({
              ok: true,
              arrayBuffer: async () => new ArrayBuffer(4),
            } as Response),
          );
        }),
    );
    const cache = new AudioBuffers(new Context().asAudio());
    const pending = Promise.all(
      Array.from({ length: 10 }, (_, i) => cache.get(`sample-${i}`)),
    );
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    while (cache.metrics.pending) {
      for (const release of releases.splice(0)) release();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await pending;
    expect(fetch).toHaveBeenCalledTimes(10);
    cache.dispose();
  });
});
