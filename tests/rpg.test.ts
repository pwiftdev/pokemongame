import { describe, it, expect } from "vitest";
import {
  ROADS,
  REGIONS,
  WAYSTONES,
  WORLD_RADIUS,
  regionBiome,
  isSafeArea,
} from "../packages/shared/regions";
import { CLASSES, CLASS_IDS } from "../packages/shared/classes";
import { COMPANIONS, SPECIES, STARTERS, SPAWNS } from "../packages/shared/data";
import { terrainHeight, walkable } from "../packages/shared/rules";
import { heroHp, heroMaxHp } from "../packages/shared/hero";
import { normalizeProfile, validateProfile } from "../apps/server/src/profile";
import { makeCreature, abilityFor } from "../apps/server/src/gameplay";
import { commandSchema } from "../apps/server/src/commands";
import type { Profile } from "../packages/shared/types";
const profile = (): Profile => ({
  id: "test",
  nickname: "Test",
  balance: 100,
  creatures: [],
  team: [],
  active: null,
  inventory: { capsule: 5 },
  quests: { defeats: 8 },
  claimed: [],
  discoveries: ["forest"],
  wins: 3,
  losses: 1,
});
describe("expanded RPG world", () => {
  it("provides eight connected, walkable destinations and a larger world", () => {
    expect(REGIONS).toHaveLength(8);
    expect((WORLD_RADIUS / 88) ** 2).toBeGreaterThan(11);
    for (const r of WAYSTONES) {
      expect(regionBiome(r.x, r.z)).toBe(r.biome);
      expect(walkable(r.x, r.z)).toBe(true);
      expect(Number.isFinite(terrainHeight(r.x, r.z))).toBe(true);
    }
    expect(SPAWNS.length).toBeLessThanOrEqual(25);
    expect(new Set(SPAWNS.map((s) => s.id)).size).toBe(SPAWNS.length);
  });
  it("keeps roads clear of authoritative buildings and landmarks", () => {
    for (const road of ROADS)
      for (let i = 1; i < road.length; i++) {
        const a = road[i - 1],
          b = road[i],
          length = Math.hypot(a[0] - b[0], a[1] - b[1]);
        for (let step = 0; step < length; step++) {
          const t = step / length;
          expect(
            walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t),
          ).toBe(true);
        }
      }
  });
  it("protects every waystone without making its whole biome safe", () => {
    for (const r of WAYSTONES) expect(isSafeArea(r.x, r.z)).toBe(true);
    expect(isSafeArea(0, 190)).toBe(false);
  });
  it("separates hostile monsters from actual Pokémon companions", () => {
    expect(STARTERS).toEqual(["bulbasaur", "charmander", "squirtle"]);
    expect(COMPANIONS.every((s) => s.companion)).toBe(true);
    expect(Object.values(SPECIES).filter((s) => !s.companion)).toHaveLength(12);
  });
  it("keeps class abilities available with the companion dismissed", () => {
    const p = profile();
    for (const classId of CLASS_IDS) {
      p.classId = classId;
      expect(CLASSES[classId].abilities).toHaveLength(6);
      expect(abilityFor(p, 0)).toEqual(CLASSES[classId].abilities[0]);
      expect(["guard", "evasion"]).toContain(abilityFor(p, 3).effect);
    }
    expect(() => abilityFor(p, 0, true)).toThrow("Deploy");
  });
  it("migrates old collections without losing identities, progression or economy", () => {
    const p = profile(),
      c = makeCreature("cindercub", 7);
    c.evolved = true;
    c.nickname = "Copper";
    c.hp = 20;
    c.xp = 17;
    p.creatures = [c];
    p.team = [c.id];
    p.active = c.id;
    const id = c.id;
    normalizeProfile(p);
    expect(c.species).toBe("charmander");
    expect(c).toMatchObject({
      id,
      level: 7,
      xp: 17,
      evolved: true,
      nickname: "Copper",
    });
    expect(p.team).toEqual([id]);
    expect(p.balance).toBe(100);
    expect(p.quests.defeats).toBe(8);
    expect(p.wins).toBe(3);
    expect(heroHp(p)).toBe(heroMaxHp(p));
    const once = structuredClone(p);
    normalizeProfile(p);
    expect(p).toEqual(once);
    validateProfile(p);
  });
  it("rejects invalid class, pet and travel commands and invalid hero health", () => {
    const requestId = "f6e4dc40-ef17-4d87-8509-b34b2c5e7cde";
    for (const command of [
      { kind: "class", classId: "admin" },
      { kind: "pet", mode: "teleport" },
      { kind: "travel", destination: "", x: 999 },
    ])
      expect(commandSchema.safeParse({ ...command, requestId }).success).toBe(
        false,
      );
    const p = profile();
    p.heroHp = -1;
    expect(() => validateProfile(p)).toThrow("hero health");
  });
});
