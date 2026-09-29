import { describe, expect, it } from "vitest";
import { bossCast, castHits } from "../boss.js";
describe("authoritative boss telegraphs", () => {
  it("warns for 1.2 seconds before impact and makes three distinct attacks", () => {
    const boss = { x: 6, z: 76 },
      target = { x: 10, z: 70 };
    const casts = [0, 1, 2].map((i) => bossCast(boss, target, i, 1000));
    expect(casts.map((c) => c.ability)).toEqual(["zap", "wave", "storm"]);
    expect(casts.map((c) => c.radius)).toEqual([5, 11, 4]);
    expect(castHits(casts[0], boss, 2199)).toBe(false);
    expect(castHits(casts[0], boss, 2200)).toBe(true);
  });
  it("locks Skyfall to cast location so moving out genuinely avoids damage", () => {
    const target = { x: 8, z: 70 };
    const cast = bossCast({ x: 6, z: 76 }, target, 2, 1000);
    target.x = 18;
    expect(cast.x).toBe(8);
    expect(castHits(cast, target, 2200)).toBe(false);
    expect(castHits(cast, { x: 8, z: 70 }, 2200)).toBe(true);
  });
  it("rechecks line of sight at impact", () => {
    const cast = {
      ability: "wave",
      x: 30,
      z: 23,
      radius: 11,
      resolvesAt: 1000,
    };
    expect(castHits(cast, { x: 39, z: 23 }, 1000)).toBe(false);
  });
});
