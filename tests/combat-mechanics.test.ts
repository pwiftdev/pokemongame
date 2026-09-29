import { describe, it, expect } from "vitest";
import {
  DASH,
  castInterrupted,
  castTiming,
  dashStep,
  shapeContains,
  attackHits,
  type HeroCast,
} from "../packages/shared/combat";
import { creatureCast } from "../apps/server/src/boss";
import { commandSchema } from "../apps/server/src/commands";
import { randomUUID } from "node:crypto";

const cast: HeroCast = {
  ability: "meteor",
  target: "enemy",
  x: -12,
  z: -5,
  aimX: -12,
  aimZ: 5,
  startedAt: 1000,
  releasesAt: 2200,
  resolvesAt: 2660,
};
describe("authoritative fighting mechanics", () => {
  it("gives spells a windup and flight while weapon hits follow the swing", () => {
    expect(castTiming("meteor", 10)).toEqual({
      windup: 1200,
      flight: 460,
      stationary: true,
    });
    expect(castTiming("firebolt", 14).flight).toBe(500);
    expect(castTiming("slash", 3)).toEqual({
      windup: 230,
      flight: 0,
      stationary: false,
    });
  });
  it("interrupts movement and stuns before release, including the release boundary", () => {
    expect(castInterrupted(cast, { x: -11, z: -5 }, false, 1400)).toBe(true);
    expect(castInterrupted(cast, { x: -11, z: -5 }, false, 2200)).toBe(true);
    expect(castInterrupted(cast, cast, true, 1400)).toBe(true);
    expect(
      castInterrupted({ ...cast, released: true }, { x: 0, z: 0 }, true, 2300),
    ).toBe(false);
    expect(
      castInterrupted(
        { ...cast, ability: "slash" },
        { x: -11, z: -5 },
        false,
        1100,
      ),
    ).toBe(false);
  });
  it("distinguishes claws, heavy cleaves, charges and ranged attacks", () => {
    const from = { x: -12, z: -5 },
      target = { x: -12, z: -2 };
    const claw = creatureCast("leaf-tap", target, 1000, from, 0, "leaf");
    expect(claw.shape).toBe("cone");
    expect(attackHits(claw, target, 1379)).toBe(false);
    expect(attackHits(claw, target, 1380)).toBe(true);
    expect(shapeContains(claw, { x: -12, z: -7 })).toBe(false);
    const heavy = creatureCast("leaf-tap", target, 1000, from, 1, "leaf");
    expect(heavy.arc).toBeGreaterThan(claw.arc!);
    const charge = creatureCast("leaf-tap", target, 1000, from, 2, "leaf");
    expect(charge.charge).toBe(true);
    const bolt = creatureCast("ember", target, 1000, from, 0, "flame");
    expect(shapeContains(bolt, { x: -12, z: 6 })).toBe(true);
    expect(shapeContains(bolt, { x: -10, z: 6 })).toBe(false);
    expect(shapeContains(bolt, { x: -12, z: -6 })).toBe(false);
    target.x += 8;
    expect(bolt.yaw).toBe(0);
  });
  it("hits only where a travelling bolt currently is, once it has released", () => {
    const bolt = creatureCast(
      "ember",
      { x: -12, z: 5 },
      1000,
      { x: -12, z: -5 },
      0,
      "flame",
    );
    const victim = { x: -12, z: 0 };
    expect(attackHits(bolt, victim, 1300)).toBe(false);
    expect(attackHits(bolt, victim, 1500)).toBe(false);
    expect(attackHits(bolt, victim, 1600)).toBe(true);
    expect(attackHits(bolt, victim, 1800)).toBe(false);
    expect(attackHits(bolt, { x: -10, z: 0 }, 1600)).toBe(false);
  });
  it("sweeps dash collision instead of tunnelling through buildings or creatures", () => {
    const wall = dashStep(
      { x: -39, z: 10 },
      { x: 1, z: 0 },
      DASH.duration / 1000,
      [],
    );
    expect(wall.x).toBeLessThan(-38);
    const mob = dashStep(
      { x: -12, z: -5 },
      { x: 0, z: 1 },
      DASH.duration / 1000,
      [{ x: -12, z: -2, hp: 30, boss: false, elite: false }],
    );
    expect(mob.z).toBeLessThanOrEqual(-3.05);
    const free = dashStep(
      { x: -12, z: -5 },
      { x: 0, z: 1 },
      DASH.duration / 1000,
      [],
    );
    expect(free.z + 5).toBeCloseTo(5.76);
  });
  it("rejects forged dash magnitudes and nonfinite input", () => {
    for (const dx of [2, NaN, Infinity])
      expect(
        commandSchema.safeParse({
          kind: "dash",
          requestId: randomUUID(),
          dx,
          dz: 0,
        }).success,
      ).toBe(false);
  });
});
