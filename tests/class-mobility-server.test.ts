import { guestCanReach } from "../packages/shared/access";
import { ABILITIES } from "../packages/shared/data";
import { describe, expect, it, vi } from "vitest";
import { IslandRoom, type Player } from "../apps/server/src/room";
import { makeCreature } from "../apps/server/src/gameplay";
import type { Profile } from "../packages/shared/types";
const mobilityMethods = IslandRoom.prototype as unknown as {
  advanceMobility: (p: Player, now: number) => Promise<void>;
  limitStep: (
    p: Player,
    next: { x: number; z: number },
  ) => { x: number; z: number };
};
const advance = mobilityMethods.advanceMobility;
function fixture() {
  const creature = makeCreature("bulbasaur", 10);
  const p = {
    profile: {
      heroHp: 100,
      creatures: [creature],
      active: creature.id,
    } as Profile,
    x: -12,
    z: -5,
    stunUntil: 0,
    mobility: {
      from: { x: -12, z: -5 },
      to: { x: -12, z: 3 },
      startedAt: 1000,
      until: 1500,
      ability: "charge",
      target: "enemy",
    },
  } as Player;
  const target = { x: -12, z: 5 },
    impactAttack = vi.fn(),
    startAuto = vi.fn();
  const context = {
    limitStep: mobilityMethods.limitStep,
    wilds: new Map([["enemy", target]]),
    players: new Map(),
    impactAttack,
    startAuto,
  };
  return { p, target, context, impactAttack, startAuto };
}
describe("authoritative charge completion", () => {
  it("travels over time, hits once and continues melee", async () => {
    const f = fixture();
    await advance.call(f.context, f.p, 1250);
    expect(f.p.z).toBeCloseTo(-1);
    expect(f.impactAttack).not.toHaveBeenCalled();
    await advance.call(f.context, f.p, 1500);
    await advance.call(f.context, f.p, 1600);
    expect(f.p.z).toBeCloseTo(3);
    expect(f.p.mobility).toBeUndefined();
    expect(f.impactAttack).toHaveBeenCalledTimes(1);
    expect(f.startAuto).toHaveBeenCalledTimes(1);
  });
  it("stuns and defeat interrupt a charge without hitting or moving", async () => {
    for (const state of ["stun", "death", "duel defeat"]) {
      const f = fixture();
      if (state === "stun") f.p.stunUntil = 2000;
      if (state === "death") f.p.profile.heroHp = 0;
      if (state === "duel defeat") {
        f.p.duelId = "duel";
        f.p.duelHp = 0;
      }
      await advance.call(f.context, f.p, 1600);
      expect(f.p.mobility).toBeUndefined();
      expect(f.p.z).toBe(-5);
      expect(f.impactAttack).not.toHaveBeenCalled();
    }
  });
  it("does not hit an opponent who has moved away during the charge", async () => {
    const f = fixture();
    f.target.z = 20;
    await advance.call(f.context, f.p, 1500);
    expect(f.p.mobility).toBeUndefined();
    expect(f.impactAttack).not.toHaveBeenCalled();
    expect(f.startAuto).not.toHaveBeenCalled();
  });
});

it("keeps Blink and Charge inside guest regions while wallet heroes can cross", async () => {
  const methods = IslandRoom.prototype as unknown as {
    skillDestination: (
      p: Player,
      ability: typeof ABILITIES.blink,
    ) => { x: number; z: number };
  };
  const f = fixture();
  f.p.x = 11.5;
  f.p.z = 20;
  f.p.yaw = Math.PI / 2;
  const context = { ...f.context, duels: new Map() };
  expect(() =>
    methods.skillDestination.call(context, f.p, ABILITIES.blink),
  ).toThrow(/room to blink/);
  f.p.profile.wallet = "test-wallet";
  const wallet = methods.skillDestination.call(context, f.p, ABILITIES.blink);
  expect(wallet.x).toBeGreaterThan(f.p.x);
  delete f.p.profile.wallet;
  f.p.mobility = {
    ...f.p.mobility!,
    from: { x: 11.5, z: 20 },
    to: { x: 20, z: 20 },
  };
  await advance.call(context, f.p, 1500);
  expect(guestCanReach(f.p.x, f.p.z)).toBe(true);
  expect(f.impactAttack).not.toHaveBeenCalled();
});
