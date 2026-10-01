import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  appearanceKey,
  validAppearance,
  cleanDisplayName,
  validDisplayName,
  RACE_IDS,
  BODY_IDS,
} from "../packages/shared/appearance";
import { commandSchema } from "../apps/server/src/commands";
import { normalizeProfile, validateProfile } from "../apps/server/src/profile";
import type { Profile } from "../packages/shared/types";
const command = (appearance: unknown) => ({
  kind: "appearance",
  requestId: randomUUID(),
  appearance,
});
describe("character appearance and names", () => {
  it("migrates old profiles without changing gameplay or inventory", () => {
    const profile: Profile = {
      id: "test",
      nickname: "Explorer",
      balance: 100,
      creatures: [],
      team: [],
      active: null,
      inventory: { capsule: 5 },
      quests: {},
      claimed: [],
      discoveries: [],
      wins: 0,
      losses: 0,
    };
    normalizeProfile(profile);
    expect(profile.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(profile.balance).toBe(100);
    expect(profile.inventory).toEqual({ capsule: 5 });
    expect(() => validateProfile(profile)).not.toThrow();
  });
  it("accepts every race and body and ignores object property order", () => {
    for (const race of RACE_IDS)
      for (const body of BODY_IDS) {
        const appearance = { ...DEFAULT_APPEARANCE, race, body };
        const reordered = Object.fromEntries(
          Object.entries(appearance).reverse(),
        );
        expect(validAppearance(reordered)).toBe(true);
        expect(appearanceKey(reordered)).toBe(appearanceKey(appearance));
        expect(commandSchema.parse(command(appearance))).toMatchObject({
          appearance,
        });
      }
  });
  it.each([
    { race: "dragon" },
    { body: "url" },
    { height: 10 },
    { height: NaN },
    { jaw: Infinity },
    { skin: 8 },
    { hairColor: -1 },
    { eyeColor: 1.1 },
    { outfitColor: 100 },
    { nose: 2 },
    { ears: -1 },
    { shoulders: "true" },
    { asset: "https://untrusted.example/model.glb" },
  ])("rejects untrusted appearance values %j", (value) => {
    const appearance = { ...DEFAULT_APPEARANCE, ...value };
    expect(commandSchema.safeParse(command(appearance)).success).toBe(false);
    expect(validAppearance(appearance)).toBe(false);
    expect(validAppearance(normalizeAppearance(appearance as never))).toBe(
      true,
    );
  });
  it("normalizes international names and blocks markup, controls and oversized names", () => {
    expect(cleanDisplayName("  Éowyn   O’Neil ".replace("’", "'"))).toBe(
      "Éowyn O'Neil",
    );
    for (const name of ["Éowyn", "李明", "Borin Stone", "O'Neil", "Ash-2"])
      expect(validDisplayName(name)).toBe(true);
    for (const name of [
      "<script>",
      "abc\u202edef",
      "abc\u0000",
      "A".repeat(19),
      "",
    ])
      expect(validDisplayName(name)).toBe(false);
    const pet = {
      kind: "renamePet",
      requestId: randomUUID(),
      creature: randomUUID(),
      nickname: "  Leaf  ",
    };
    expect(commandSchema.parse(pet)).toMatchObject({ nickname: "Leaf" });
    expect(commandSchema.safeParse({ ...pet, nickname: "" }).success).toBe(
      true,
    );
    expect(
      commandSchema.safeParse({ ...pet, creature: "../../other" }).success,
    ).toBe(false);
  });
});
