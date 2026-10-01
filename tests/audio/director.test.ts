import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameAudio } from "../../apps/client/src/audio";
import { AudioMixer } from "../../apps/client/src/audio/mixer";
import {
  CAPTURE_TIMING,
  capturePresentation,
} from "../../packages/shared/pokedex";
import type { WorldSnapshot } from "../../packages/shared/types";
import { Context, setupAudio } from "./fakes";
let documentStub: EventTarget & { hidden: boolean };
beforeEach(() => {
  setupAudio();
  vi.useFakeTimers();
  documentStub = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("AudioContext", Context);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function director() {
  const game = new GameAudio();
  game.configure({ music: 0, ambience: 0 });
  game.setSnapshot(
    { players: [], wilds: [], duels: [] } as unknown as WorldSnapshot,
    "trainer",
  );
  await game.start();
  return game;
}
function capture(game: GameAudio) {
  game.handleEvent({
    type: "capture",
    message: "",
    source: "trainer",
    capture: {
      ...capturePresentation(true, 0.5),
      species: "bulbasaur",
      shiny: false,
    },
  });
}
it("aligns capture sounds with visual shakes and the reveal", async () => {
  const game = await director();
  const play = vi.spyOn(AudioMixer.prototype, "play").mockResolvedValue();
  capture(game);
  await vi.advanceTimersByTimeAsync(CAPTURE_TIMING.flight - 1);
  expect(play.mock.calls.filter(([id]) => id === "capture-shake")).toHaveLength(
    0,
  );
  await vi.advanceTimersByTimeAsync(1);
  expect(play.mock.calls.filter(([id]) => id === "capture-shake")).toHaveLength(
    1,
  );
  await vi.advanceTimersByTimeAsync(4000);
  expect(play.mock.calls.filter(([id]) => id === "reward")).toHaveLength(1);
  game.dispose();
});
it("cancels delayed sounds across mute, tab hiding and disconnect/reconnect", async () => {
  for (const action of ["mute", "hidden", "disconnect"] as const) {
    documentStub.hidden = false;
    const game = await director();
    const play = vi.spyOn(AudioMixer.prototype, "play").mockResolvedValue();
    capture(game);
    if (action === "mute") game.configure({ mute: true });
    if (action === "hidden") {
      documentStub.hidden = true;
      documentStub.dispatchEvent(new Event("visibilitychange"));
    }
    if (action === "disconnect") game.setConnected(false);
    expect(game.metrics.scheduled).toBe(0);
    game.configure({ mute: false });
    documentStub.hidden = false;
    documentStub.dispatchEvent(new Event("visibilitychange"));
    game.setConnected(true);
    play.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(play).not.toHaveBeenCalled();
    game.dispose();
    play.mockRestore();
  }
});
it("drops delayed effects and timers after disposal", async () => {
  const game = await director();
  capture(game);
  game.dispose();
  await vi.advanceTimersByTimeAsync(0);
  expect(game.metrics.scheduled).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("locates target-only wild defeat events without playing distant defeats", async () => {
  const game = await director();
  game.setSnapshot(
    {
      players: [],
      duels: [],
      wilds: [
        { id: "near", x: 0, z: -30 },
        { id: "far", x: 200, z: 200 },
      ],
    } as unknown as WorldSnapshot,
    "trainer",
  );
  const play = vi.spyOn(AudioMixer.prototype, "play").mockResolvedValue();
  game.handleEvent({ type: "defeat", message: "", target: "near" });
  game.handleEvent({ type: "defeat", message: "", target: "far" });
  expect(play).toHaveBeenCalledExactlyOnceWith(
    "creature-faint",
    { id: "near", x: 0, z: -30 },
    1,
    1,
  );
  game.dispose();
});
