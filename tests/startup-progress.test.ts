import { describe, expect, it } from "vitest";
import {
  createStartupProgress,
  modelGroup,
} from "../apps/client/src/loading/progress";
describe("startup readiness", () => {
  it("does not announce readiness before every asset finishes", async () => {
    const progress = createStartupProgress();
    progress.begin();
    let release!: () => void;
    const pending = progress.track(
      "model",
      "pokemon",
      "Bulbasaur",
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    expect(progress.tasks[0].state).toBe("loading");
    expect(() => progress.finish()).toThrow();
    release();
    await pending;
    progress.finish();
    expect(progress.active).toBe(false);
  });
  it("retains failed assets and never treats failure as ready", async () => {
    const progress = createStartupProgress();
    progress.begin();
    await expect(
      progress.track("portrait", "interface", "Portrait", async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(progress.tasks[0].state).toBe("failed");
    expect(() => progress.finish()).toThrow();
  });
  it("does not track unrelated model loads before startup or after completion", async () => {
    const progress = createStartupProgress();
    await progress.track("studio", "characters", "Studio", async () => 1);
    expect(progress.tasks).toEqual([]);
    progress.begin();
    await progress.track("initial", "engine", "Engine", async () => 1);
    progress.finish();
    await progress.track("studio", "characters", "Studio", async () => 1);
    expect(progress.tasks).toHaveLength(1);
  });
  it("clears a discarded startup and unregisters listeners", async () => {
    const progress = createStartupProgress();
    let changes = 0;
    const off = progress.subscribe(() => changes++);
    progress.begin();
    await progress.track("initial", "world", "Island", async () => 1);
    off();
    const before = changes;
    progress.begin();
    expect(progress.tasks).toEqual([]);
    expect(changes).toBe(before);
  });
  it("uses the same groups for the actual model URLs", () => {
    expect(modelGroup("/assets/pokemon/Eevee.glb")).toBe("pokemon");
    expect(modelGroup("/assets/characters/Male.glb")).toBe("characters");
    expect(modelGroup("/assets/world/Temple.glb")).toBe("world");
  });
});
