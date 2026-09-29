import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  ITEMS,
  QUESTS,
  SPAWNS,
  SPECIES,
  STARTERS,
  WORLD,
  OBSTACLES,
} from "../packages/shared/data";
import {
  captureChance,
  effectiveness,
  lineOfSight,
  maxHp,
  moveWithCollision,
  walkable,
  xpForLevel,
} from "../packages/shared/rules";
describe("authored game content", () => {
  it("provides valid moves for twelve enemy species and three Pokémon companions, with reachable authored spawns", () => {
    expect(Object.keys(SPECIES)).toHaveLength(15);
    for (const s of Object.values(SPECIES)) {
      expect(s.moves).toHaveLength(4);
      for (const m of s.moves) expect(ABILITIES[m]).toBeDefined();
    }
    for (const s of SPAWNS) expect(walkable(s.x, s.z), s.id).toBe(true);
  });
  it("provides all release content counts and three real stat ascensions", () => {
    expect(STARTERS).toHaveLength(3);
    expect(Object.keys(ABILITIES).length).toBeGreaterThanOrEqual(18);
    expect(Object.keys(ITEMS).length).toBeGreaterThanOrEqual(8);
    expect(QUESTS.filter((q) => !q.repeatable).length).toBeGreaterThanOrEqual(
      10,
    );
    expect(QUESTS.filter((q) => q.side)).toHaveLength(4);
    expect(SPAWNS.filter((s) => s.elite)).toHaveLength(5);
    expect(SPAWNS.filter((s) => s.boss)).toHaveLength(1);
    for (const id of STARTERS)
      expect(maxHp(id, 6, true)).toBeGreaterThan(maxHp(id, 6));
  });
  it("has an acyclic quest chain with valid prerequisites", () => {
    for (const q of QUESTS) {
      const seen = new Set<string>();
      let current = q;
      while (current.prerequisite) {
        expect(seen.has(current.id)).toBe(false);
        seen.add(current.id);
        const parent = QUESTS.find((p) => p.id === current.prerequisite);
        expect(parent).toBeDefined();
        current = parent!;
      }
    }
  });
});
describe("authoritative rules", () => {
  it("bounds capture probability and rewards weakened targets and quality", () => {
    expect(captureChance(0.2, 10, 100)).toBeGreaterThan(
      captureChance(0.2, 100, 100),
    );
    expect(captureChance(0.2, 10, 100, 1.55)).toBeGreaterThan(
      captureChance(0.2, 10, 100),
    );
    for (let hp = 0; hp <= 100; hp++)
      for (const quality of [1, 1.55]) {
        const p = captureChance(0.4, hp, 100, quality, true, true);
        expect(p).toBeGreaterThanOrEqual(0.08);
        expect(p).toBeLessThanOrEqual(0.92);
      }
  });
  it("rejects invalid movement and blocks occupied areas", () => {
    expect(walkable(NaN, 1)).toBe(false);
    expect(walkable(Infinity, 1)).toBe(false);
    expect(walkable(WORLD.radius + 1, 0)).toBe(false);
    for (const o of OBSTACLES) expect(walkable(o.x, o.z)).toBe(false);
    const p = moveWithCollision(WORLD.radius - 1, 0, 5, 0);
    expect(p.x).toBe(WORLD.radius - 1);
  });
  it("blocks attacks through the same geometry used for movement", () => {
    expect(lineOfSight({ x: -15, z: -35 }, { x: -5, z: -35 })).toBe(false);
    expect(lineOfSight({ x: 0, z: 0 }, { x: 5, z: 5 })).toBe(true);
  });
  it("uses meaningful element interactions and increasing level costs", () => {
    expect(effectiveness("flame", "leaf")).toBe(1.5);
    expect(effectiveness("flame", "tide")).toBe(0.7);
    expect(effectiveness("flame", "stone")).toBe(1);
    expect(xpForLevel(20)).toBeGreaterThan(xpForLevel(1));
  });
});
