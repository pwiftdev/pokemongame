import { expect, it, vi } from "vitest";
vi.mock("../db.js", () => ({
  mutate: vi.fn(),
  recordMatch: vi.fn(),
  authenticate: vi.fn(),
  captureOwner: vi.fn(),
  getProfile: vi.fn(),
}));
import { IslandRoom, type Player, type Wild } from "../room.js";
import {
  hitTrainingTarget,
  resetPractice,
  tickTrainingTarget,
  trainingHealth,
} from "../training.js";
import { TRAINING_SPECIES } from "../../../../packages/shared/training.js";
import { applyAura } from "../auras.js";
import { mutate } from "../db.js";
function fixture() {
  const target = {
    id: "training-execute",
    species: TRAINING_SPECIES,
    x: 40,
    z: -25,
    hp: 600,
    maxHp: 3000,
    lastAttack: 0,
    auras: new Map(),
    threat: new Map(),
    contributors: new Map(),
    state: "idle",
  } as unknown as Wild;
  const a = { profile: { id: "a" }, x: 40, z: -26, online: true } as Player;
  const b = { profile: { id: "b" }, x: 40, z: -26, online: true } as Player;
  return {
    target,
    a,
    b,
    players: new Map([
      ["a", a],
      ["b", b],
    ]),
  };
}
it("keeps targets alive, personal scores separate, and never creates kill rewards", async () => {
  const { target, a, b } = fixture();
  hitTrainingTarget(a, target, 1000, "slash", 1000);
  hitTrainingTarget(b, target, 50, "strike", 1200);
  expect(target.hp).toBe(1);
  expect(a.practice?.damage).toBe(1000);
  expect(b.practice?.damage).toBe(50);
  expect(target.contributors.size).toBe(0);
  const room = new IslandRoom();
  const runtime = room as unknown as {
    defeatWild: (w: Wild) => Promise<void>;
    rewardWild: (w: Wild) => Promise<void>;
  };
  try {
    await runtime.defeatWild(target);
    await runtime.rewardWild(target);
    expect(mutate).not.toHaveBeenCalled();
    expect(target.state).toBe("idle");
  } finally {
    await room.onDispose();
  }
});
it("resets execute health after inactivity and drops combat AI targets", () => {
  const { target, a, players } = fixture();
  hitTrainingTarget(a, target, 80, "strike", 1000);
  target.target = "a";
  target.threat.set("a", 80);
  tickTrainingTarget(target, players, 12000, vi.fn());
  expect(target.hp).toBe(trainingHealth(target.id, 3000));
  expect(target.hp).toBe(600);
  expect(target.threat.size).toBe(0);
  expect(target.target).toBeUndefined();
});
it("counts damage-over-time only for the present non-dueling attacker and resets only their effects", () => {
  const { target, a, b, players } = fixture();
  applyAura(target, "burn", 1000, 4000, {
    source: "a",
    ability: "fireball",
    tick: 10,
  });
  applyAura(target, "poison", 1000, 6000, {
    source: "b",
    ability: "poison",
    tick: 8,
  });
  b.duelId = "other";
  tickTrainingTarget(target, players, 2100, vi.fn());
  expect(a.practice?.damage).toBe(10);
  expect(b.practice).toBeUndefined();
  applyAura(target, "slow", 2100, 4000, { source: "a" });
  a.auto = { target: target.id, next: 3000 };
  resetPractice(a, new Map([[target.id, target]]));
  expect(a.practice).toBeUndefined();
  expect(a.auto).toBeUndefined();
  expect(target.auras.has("burn")).toBe(false);
  expect(target.slowUntil).toBe(0);
  expect(target.auras.has("poison")).toBe(true);
});

it("wooden targets cannot dodge, parry or block hero practice attacks", async () => {
  const { a, target } = fixture();
  const room = new IslandRoom();
  try {
    const runtime = room as unknown as {
      heroChances: (
        p: Player,
        ability: undefined,
        w: Wild,
        opponent: undefined,
        companion: boolean,
      ) => Record<string, number>;
    };
    expect(
      runtime.heroChances(a, undefined, target, undefined, false),
    ).toMatchObject({ miss: 0, dodge: 0, parry: 0, block: 0 });
  } finally {
    await room.onDispose();
  }
});
