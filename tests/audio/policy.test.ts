import { describe, expect, it } from "vitest";
import {
  normalizeAudio,
  spatialMix,
  tracks,
  cues,
} from "../../apps/client/src/audio/catalog";
import {
  footSurface,
  soundscape,
} from "../../apps/client/src/audio/soundscape";
import { abilitySound, impactSound } from "../../apps/client/src/audio/combat";
import manifest from "../../ASSET_MANIFEST.json";
import {
  FIRE_SOURCES,
  WATERFALL,
} from "../../packages/shared/environment-features";
describe("sound selection and mix policy", () => {
  it("migrates old volume settings and rejects non-finite channel gains", () => {
    expect(
      normalizeAudio({ master: 8, music: NaN, effects: -2, mute: true }),
    ).toMatchObject({
      master: 1,
      music: 0.45,
      effects: 0,
      mute: true,
      ambience: 0.65,
    });
  });
  it("attenuates distant sounds and rotates the stereo image with the camera", () => {
    expect(spatialMix({ x: 0, z: 0 }, { x: 50, z: 0 }).volume).toBe(0);
    expect(
      spatialMix({ x: 0, z: 0 }, { x: 10, z: 0 }, -Math.PI / 2).pan,
    ).toBeGreaterThan(0);
    expect(
      spatialMix({ x: 0, z: 0 }, { x: 10, z: 0 }, Math.PI / 2).pan,
    ).toBeLessThan(0);
    expect(spatialMix({ x: 0, z: 0 }, { x: 0, z: 0 }).volume).toBe(1);
  });
  it("selects footsteps from actual world geography", () => {
    expect(footSurface({ x: 0, z: -32 })).toBe("step-stone");
    expect(footSurface({ x: -60, z: 30 })).toBe("step-grass");
    expect(footSurface({ x: -180, z: 20 })).toBe("step-sand");
    expect(footSurface({ x: 10, z: 200 })).toBe("step-snow");
    expect(footSurface({ x: 170, z: 30 })).toBe("step-water");
  });
  it("changes wildlife for night and rain and locates water and fires from shared geometry", () => {
    const ids = (night: boolean, rain = false) =>
      soundscape("forest", WATERFALL.bottom, night, rain).map((l) => l.id);
    expect(ids(false)).toContain("birds");
    expect(ids(true)).not.toContain("birds");
    expect(ids(true)).toContain("swamp");
    expect(ids(false, true)).toContain("rain");
    expect(ids(false, true)).not.toContain("birds");
    expect(ids(false)).toContain("river");
    expect(
      soundscape("desert", { x: 290, z: 0 }, false).find(
        (layer) => layer.id === "waves",
      )?.point,
    ).toEqual({ x: 300, z: 0 });
    const [x, z] = FIRE_SOURCES[0];
    expect(soundscape("town", { x, z }, false).map((l) => l.id)).toContain(
      "fire",
    );
  });
  it("distinguishes Pokémon elements and defensive combat outcomes", () => {
    expect(abilitySound("pk-ember")).toBe("fire");
    expect(abilitySound("pk-water-gun")).toBe("water");
    expect(abilitySound("pk-ice-beam")).toBe("ice-cast");
    expect(impactSound({ type: "hit", message: "", outcome: "parry" })).toBe(
      "metal",
    );
    expect(impactSound({ type: "hit", message: "", heal: true })).toBe("heal");
  });
  it("references only packaged, credited audio files", () => {
    const names = new Set(
      manifest.filter((a) => a.kind === "audio").map((a) => a.name),
    );
    for (const cue of Object.values(cues))
      for (const file of cue.files) expect(names.has(file), file).toBe(true);
    for (const track of [...Object.values(tracks), "combat"])
      expect(names.has(`music-${track}`)).toBe(true);
  });
});
