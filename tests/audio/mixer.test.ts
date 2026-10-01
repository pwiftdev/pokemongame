import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioMixer } from "../../apps/client/src/audio/mixer";
import { Context, setupAudio, buffer } from "./fakes";
beforeEach(setupAudio);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("audio mixing boundaries", () => {
  it("drops distant events before fetching their samples", async () => {
    const mixer = new AudioMixer(new Context().asAudio());
    await mixer.play("heavy", { x: 200, z: 200 });
    expect(fetch).not.toHaveBeenCalled();
    mixer.dispose();
  });
  it("does not play stale effects when a slow download completes", async () => {
    vi.useFakeTimers();
    const context = new Context();
    let finish!: (value: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const mixer = new AudioMixer(context.asAudio());
    const pending = mixer.play("hit");
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(350);
    finish(buffer());
    await pending;
    expect(context.sources).toHaveLength(0);
    mixer.dispose();
  });
  it("does not resurrect muted or disposed playback after an async download", async () => {
    for (const dispose of [false, true]) {
      const context = new Context();
      let finish!: (value: AudioBuffer) => void;
      context.decodeAudioData.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const mixer = new AudioMixer(context.asAudio());
      const pending = mixer.play("ui");
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      if (dispose) mixer.dispose();
      else mixer.configure({ mute: true });
      finish(buffer());
      await pending;
      expect(context.sources).toHaveLength(0);
      if (!dispose) mixer.dispose();
    }
  });
  it("caps simultaneous effects and stops them when the tab is silenced", async () => {
    vi.useFakeTimers();
    const context = new Context();
    const mixer = new AudioMixer(context.asAudio());
    for (let i = 0; i < 35; i++) {
      await mixer.play("hit");
      await vi.advanceTimersByTimeAsync(80);
    }
    expect(mixer.metrics.voices).toBe(24);
    mixer.setActive(false);
    expect(mixer.metrics.voices).toBe(0);
    expect(context.state).toBe("suspended");
    mixer.dispose();
  });
  it("discards obsolete ambience after a region change while loading", async () => {
    const context = new Context();
    let finish!: (value: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const mixer = new AudioMixer(context.asAudio());
    mixer.configure({ music: 0 });
    mixer.update("town", [{ id: "birds", volume: 1 }]);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    mixer.update("town", []);
    finish(buffer());
    await vi.waitFor(() => expect(mixer.metrics.pending).toBe(0));
    expect(mixer.metrics.loops).toBe(0);
    mixer.dispose();
  });
});
