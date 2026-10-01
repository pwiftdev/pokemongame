import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicPlayer } from "../../apps/client/src/audio/music";
import { Context, Media, setupAudio } from "./fakes";
beforeEach(setupAudio);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("streamed music transitions", () => {
  it("crossfades with at most two streams even during rapid region changes", async () => {
    const context = new Context(),
      music = new MusicPlayer(
        context.asAudio(),
        context.destination as unknown as AudioNode,
      );
    for (const track of ["town", "forest", "combat", "winter"]) {
      music.update(track, true);
      await Promise.resolve();
      await Promise.resolve();
      expect(music.metrics.streams).toBeLessThanOrEqual(2);
    }
    music.dispose();
    expect(music.metrics.streams).toBe(0);
    expect(Media.instances.every((m) => m.paused)).toBe(true);
  });
  it("pauses and resumes the current track without restarting it", async () => {
    const context = new Context(),
      music = new MusicPlayer(
        context.asAudio(),
        context.destination as unknown as AudioNode,
      );
    music.update("town", true);
    await Promise.resolve();
    await Promise.resolve();
    const media = Media.instances[0];
    media.currentTime = 37;
    music.update("town", false);
    expect(media.paused).toBe(true);
    music.update("town", true);
    expect(media.currentTime).toBe(37);
    expect(Media.instances).toHaveLength(1);
    music.dispose();
  });
  it("does not activate a pending track after disposal", async () => {
    let finish!: () => void;
    class SlowMedia extends Media {
      override play = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    }
    vi.stubGlobal("Audio", SlowMedia);
    const context = new Context(),
      music = new MusicPlayer(
        context.asAudio(),
        context.destination as unknown as AudioNode,
      );
    music.update("town", true);
    music.dispose();
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(music.metrics.streams).toBe(0);
  });
  it("handles node creation failure and retries only after backoff", async () => {
    vi.useFakeTimers();
    const context = new Context();
    const create = vi
      .spyOn(context, "createMediaElementSource")
      .mockImplementationOnce(() => {
        throw new Error("device unavailable");
      });
    const music = new MusicPlayer(
      context.asAudio(),
      context.destination as unknown as AudioNode,
    );
    music.update("town", true);
    await vi.advanceTimersByTimeAsync(0);
    expect(music.metrics.streams).toBe(0);
    expect(Media.instances[0].paused).toBe(true);
    music.update("town", true);
    expect(create).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    music.update("town", true);
    await vi.advanceTimersByTimeAsync(0);
    expect(music.metrics.track).toBe("town");
    music.dispose();
  });
  it("times out a stalled load and cancels pending work on disposal", async () => {
    vi.useFakeTimers();
    class StalledMedia extends Media {
      override play = vi.fn(() => new Promise<void>(() => {}));
    }
    vi.stubGlobal("Audio", StalledMedia);
    const context = new Context();
    const music = new MusicPlayer(
      context.asAudio(),
      context.destination as unknown as AudioNode,
    );
    music.update("town", true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(music.metrics.streams).toBe(0);
    await vi.advanceTimersByTimeAsync(15000);
    music.update("forest", true);
    expect(music.metrics.streams).toBe(1);
    music.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
