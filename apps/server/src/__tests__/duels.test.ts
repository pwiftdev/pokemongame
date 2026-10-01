import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../db.js", () => ({
  recordMatch: vi.fn(),
  mutate: vi.fn(),
  authenticate: vi.fn(),
  getProfile: vi.fn(),
  captureOwner: vi.fn(),
}));
import { recordMatch, getProfile } from "../db.js";
import { DuelSystem } from "../duels.js";
import { IslandRoom, type Player, type Duel } from "../room.js";
import { makeCreature } from "../gameplay.js";
import { CLASS_IDS, heroClass } from "../../../../packages/shared/classes.js";
import { resourceMax } from "../../../../packages/shared/combat-rules.js";
import { DUEL_LEVEL, heroLevel } from "../../../../packages/shared/hero.js";

function player(id: string, level = 1): Player {
  const creature = makeCreature("bulbasaur", level);
  return {
    profile: {
      id,
      classId: "mage",
      creatures: [creature],
      active: creature.id,
      heroHp: 152,
    },
    client: { send: vi.fn() },
    online: true,
    x: 0,
    z: 0,
    cooldowns: new Map(),
    auras: new Map(),
    duelId: "match",
    duelHp: 180,
    stunUntil: 0,
    resource: 200,
    gcdUntil: 0,
  } as unknown as Player;
}
function setup() {
  const a = player("a"),
    b = player("b", 20);
  const players = new Map([
    ["a", a],
    ["b", b],
  ]);
  const event = vi.fn();
  const system = new DuelSystem(players, event, vi.fn());
  const duel: Duel = {
    id: "match",
    a: "a",
    b: "b",
    state: "active",
    finishing: false,
    expires: Date.now() + 180000,
  };
  const result = {
    winner: "a",
    reason: "defeat",
    profiles: [a.profile, b.profile],
  };
  vi.mocked(recordMatch).mockResolvedValue(result);
  return { a, b, players, event, system, duel, result };
}
beforeEach(() => vi.clearAllMocks());
describe("duel completion failure boundaries", () => {
  it("clears both players using the committed profiles without post-commit reads", async () => {
    const { a, b, system, duel } = setup();
    vi.mocked(getProfile).mockRejectedValue(
      new Error("database unavailable after acknowledgement"),
    );
    await system.finishDuel(duel, "a", "defeat");
    expect([a.duelId, b.duelId]).toEqual([undefined, undefined]);
    expect(getProfile).not.toHaveBeenCalled();
    await system.finishDuel(duel, "a", "defeat");
    expect(recordMatch).toHaveBeenCalledTimes(1);
  });
  it("keeps an uncommitted result retryable and respects the durable winner on retry", async () => {
    const { a, b, system, duel } = setup();
    vi.mocked(recordMatch).mockRejectedValueOnce(
      new Error("failed before commit"),
    );
    await expect(system.finishDuel(duel, "a", "defeat")).rejects.toThrow(
      "before commit",
    );
    expect(duel.state).toBe("active");
    expect(duel.finishing).toBe(false);
    expect(b.duelId).toBe("match");
    await system.finishDuel(duel, null, "timeout");
    expect(duel.winner).toBe("a");
    expect([a.duelId, b.duelId]).toEqual([undefined, undefined]);
  });
  it("survives socket and event delivery failures after acknowledgement", async () => {
    const { a, b, system, duel, event } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(a.client.send).mockImplementation(() => {
      throw new Error("closed socket");
    });
    event.mockImplementationOnce(() => {
      throw new Error("local delivery failed");
    });
    try {
      await system.finishDuel(duel, "a", "defeat");
      expect([a.duelId, b.duelId]).toEqual([undefined, undefined]);
      expect(b.client.send).toHaveBeenCalledWith("profile", b.profile);
      expect(event).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });
  it("does not overwrite a replacement session's newer duel while persistence is pending", async () => {
    const { a, players, system, duel, result } = setup();
    let acknowledge!: (value: typeof result) => void;
    vi.mocked(recordMatch).mockReturnValueOnce(
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
    );
    const finishing = system.finishDuel(duel, "a", "defeat");
    const replacement = player("b");
    replacement.duelId = "new-match";
    players.set("b", replacement);
    acknowledge(result);
    await finishing;
    expect(a.duelId).toBeUndefined();
    expect(replacement.duelId).toBe("new-match");
    expect(replacement.client.send).not.toHaveBeenCalled();
  });
});
describe("normalized class combat", () => {
  for (const classId of CLASS_IDS)
    it(`normalizes ${classId} limits and unlocks at different progression levels`, async () => {
      const { a, b, system, duel } = setup();
      a.profile.classId = b.profile.classId = classId;
      await system.startDuel(duel);
      const room = new IslandRoom();
      const runtime = room as unknown as {
        duelSystem: DuelSystem;
        maxResource: (p: Player) => number;
        update: () => Promise<boolean>;
        attack: (
          p: Player,
          target: string,
          slot: number,
          request: string,
        ) => Promise<void>;
      };
      runtime.duelSystem = system;
      system.duels.set(duel.id, duel);
      runtime.update = vi.fn().mockResolvedValue(false);
      for (const p of [a, b]) {
        expect(runtime.maxResource(p)).toBe(
          resourceMax(heroClass(classId).resource, DUEL_LEVEL),
        );
        p.resource = 1000;
        const slot = heroClass(classId).abilities.findIndex(
          (ability) => (ability.unlock ?? 1) > 1,
        );
        await runtime
          .attack(p, p === a ? "b" : "a", slot, "test")
          .catch((error) => {
            expect(error.message).not.toContain("unlocks at level");
          });
      }
      await system.finishDuel(duel, "a", "defeat");
      for (const p of [a, b])
        expect(runtime.maxResource(p)).toBe(
          resourceMax(heroClass(classId).resource, heroLevel(p.profile)),
        );
      await room.onDispose();
    });
});

describe("worldwide consent-based challenges", () => {
  function challengers() {
    const setupResult = setup();
    const { a, b, players, event } = setupResult;
    a.duelId = b.duelId = undefined;
    a.combatUntil = b.combatUntil = 0;
    a.x = 0;
    a.z = -32;
    b.x = 3;
    b.z = -32;
    const update = vi.fn().mockResolvedValue(true);
    const system = new DuelSystem(players, event, update);
    return { ...setupResult, system, update };
  }
  it("invites and accepts away from the arena without teleporting or changing adventure health", async () => {
    const { a, b, system } = challengers();
    const positions = [a.x, a.z, b.x, b.z],
      health = [a.profile.heroHp, b.profile.heroHp];
    await system.invite(a, "b", "request");
    const duel = [...system.duels.values()][0];
    expect(duel.state).toBe("invite");
    await expect(
      system.respondDuel(a, {
        kind: "duelAccept",
        id: duel.id,
        requestId: "x",
      }),
    ).rejects.toThrow("belong");
    await system.respondDuel(b, {
      kind: "duelAccept",
      id: duel.id,
      requestId: "x",
    });
    expect(duel.state).toBe("active");
    expect([a.x, a.z, b.x, b.z]).toEqual(positions);
    expect([a.profile.heroHp, b.profile.heroHp]).toEqual(health);
    await system.finishDuel(duel, "a", "surrender");
    expect([a.profile.heroHp, b.profile.heroHp]).toEqual(health);
  });
  it("rejects defeated, busy and distant opponents and rechecks range on acceptance", async () => {
    const { a, b, system } = challengers();
    b.profile.heroHp = 0;
    await expect(system.invite(a, "b", "dead")).rejects.toThrow("healed");
    b.profile.heroHp = 152;
    b.combatUntil = Date.now() + 10000;
    await expect(system.invite(a, "b", "busy")).rejects.toThrow("encounter");
    b.combatUntil = 0;
    b.x = 30;
    await expect(system.invite(a, "b", "far")).rejects.toThrow("20m");
    b.x = 3;
    await system.invite(a, "b", "near");
    const duel = [...system.duels.values()][0];
    b.x = 30;
    await expect(
      system.respondDuel(b, {
        kind: "duelAccept",
        id: duel.id,
        requestId: "x",
      }),
    ).rejects.toThrow("20m");
    expect(duel.state).toBe("invite");
    system.cancelDuel(duel);
    expect(a.duelId).toBeUndefined();
    expect(b.duelId).toBeUndefined();
  });
  it("does not publish an invitation if a session is replaced while its request is acknowledged", async () => {
    const { a, b, players, system, update } = challengers();
    update.mockImplementationOnce(async () => {
      players.set("b", { ...b });
      return true;
    });
    await expect(system.invite(a, "b", "stale")).rejects.toThrow("online");
    expect(system.duels.size).toBe(0);
    expect(a.duelId).toBeUndefined();
  });
  it("keeps arranged matches in the arena and discards stale queue members", async () => {
    const { a, b, system } = challengers();
    a.x = 15;
    a.z = -13;
    b.x = 31;
    b.z = -13;
    system.queue = ["a", "b"];
    await system.matchQueue();
    expect([...system.duels.values()][0].arena).toBe(true);
    expect([a.x, a.z, b.x, b.z]).toEqual([18, -13, 28, -13]);
    system.cancelDuel([...system.duels.values()][0]);
    b.z = -50;
    system.queue = ["a", "b"];
    await system.matchQueue();
    expect(system.duels.size).toBe(0);
  });
});
