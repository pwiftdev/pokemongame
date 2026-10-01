import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Profile } from "../../../../packages/shared/types.js";
import {
  claimQuest,
  acceptQuest,
  inspectStoryPlace,
  consume,
  gainExperience,
  makeCreature,
  purchase,
  useItem,
} from "../gameplay.js";

const baseUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const admin = new pg.Pool({ connectionString: baseUrl });
const namespace = `test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.DATABASE_URL = testUrl.toString();
const db = await import("../db.js");
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  await db.migrate();
});
afterAll(async () => {
  await db.pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
});
const player = async () =>
  (await db.session(`Test ${randomUUID().slice(0, 6)}`)).profile;
const sum = async (id: string) =>
  Number(
    (
      await db.pool.query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM ledger WHERE player_id=$1",
        [id],
      )
    ).rows[0].total,
  );

async function databaseFailure(
  match: (sql: string) => boolean,
  run: () => Promise<void>,
) {
  const client = await db.pool.connect();
  const original = client.query.bind(client);
  let armed = true;
  Object.defineProperty(client, "query", {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => {
      const result = Reflect.apply(original, client, args);
      if (armed && typeof args[0] === "string" && match(args[0])) {
        armed = false;
        return Promise.resolve(result).then(() => {
          throw new Error("injected database failure");
        });
      }
      return result;
    },
  });
  const connection = vi
    .spyOn(db.pool, "connect")
    .mockResolvedValueOnce(client as never);
  try {
    await run();
  } finally {
    connection.mockRestore();
    client.query = original as typeof client.query;
  }
}

describe("durable economy and ownership", () => {
  it("avoids redundant full profiles for transient actions but still saves and publishes changed health", async () => {
    const { IslandRoom } = await import("../room.js");
    const profile = await player();
    const send = vi.fn();
    const p = {
      profile,
      client: { send },
      online: true,
      hpDirty: false,
    } as unknown as import("../room.js").Player;
    const room = new IslandRoom();
    const runtime = room as unknown as {
      update: (
        p: import("../room.js").Player,
        id: string,
        action: () => void,
        publish: boolean,
      ) => Promise<boolean>;
    };
    try {
      await runtime.update(p, randomUUID(), () => {}, false);
      expect(send).not.toHaveBeenCalled();
      p.profile.heroHp = 0;
      p.hpDirty = true;
      await runtime.update(p, randomUUID(), () => {}, false);
      expect(send).toHaveBeenCalledWith(
        "profile",
        expect.objectContaining({ heroHp: 0 }),
      );
      expect((await db.getProfile(profile.id)).heroHp).toBe(0);
    } finally {
      await room.onDispose();
    }
  });
  it("rejects inherited object keys as item identifiers without mutation", async () => {
    const p = await player();
    for (const item of ["__proto__", "constructor", "toString"]) {
      await expect(
        db.mutate(p.id, randomUUID(), (profile, tx) =>
          purchase(profile, tx, item, 1, randomUUID()),
        ),
      ).rejects.toThrow("Unknown item");
      expect(() => useItem(p, item, false)).toThrow("Unknown item");
    }
    expect((await db.getProfile(p.id)).balance).toBe(180);
  });

  it("creates an atomic welcome grant and only stores a hash of the session secret", async () => {
    const s = await db.session("Welcome");
    expect(s.profile.balance).toBe(180);
    expect(await sum(s.profile.id)).toBe(180);
    expect((await db.authenticate(s.token)).id).toBe(s.profile.id);
    const row = (
      await db.pool.query("SELECT token_hash FROM players WHERE id=$1", [
        s.profile.id,
      ])
    ).rows[0];
    expect(row.token_hash).not.toBe(s.token);
    expect(row.token_hash).toBe(db.tokenHash(s.token));
    await expect(db.authenticate("forged")).rejects.toThrow("Invalid session");
  });
  it("serializes concurrent purchases without double spending", async () => {
    const p = await player();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        db.mutate(p.id, randomUUID(), (profile, tx) =>
          purchase(profile, tx, "prism", 1, randomUUID()),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    const saved = await db.getProfile(p.id);
    expect(saved.balance).toBe(20);
    expect(saved.inventory.prism).toBe(4);
    expect(await sum(p.id)).toBe(saved.balance);
  });
  it("replays the same request after a lost acknowledgement without consuming twice", async () => {
    const p = await player(),
      id = randomUUID();
    await db.mutate(p.id, id, (profile, tx) =>
      purchase(profile, tx, "capsule", 2, id),
    );
    const result = await db.mutate(p.id, id, () => {
      throw new Error("must not run");
    });
    expect(result.applied).toBe(false);
    expect(result.profile.balance).toBe(150);
    expect(result.profile.inventory.capsule).toBe(10);
  });
  it("rolls back ledger, inventory and request receipt at a crash boundary", async () => {
    const p = await player(),
      id = randomUUID();
    await expect(
      db.mutate(p.id, id, async (profile, tx) => {
        await purchase(profile, tx, "prism", 2, id);
        throw new Error("simulated crash before commit");
      }),
    ).rejects.toThrow("simulated crash");
    const saved = await db.getProfile(p.id);
    expect(saved.balance).toBe(180);
    expect(saved.inventory.prism).toBeUndefined();
    expect(await sum(p.id)).toBe(180);
    expect(
      (
        await db.mutate(p.id, id, (profile, tx) =>
          purchase(profile, tx, "prism", 2, id),
        )
      ).applied,
    ).toBe(true);
  });
  it("recovers an ambiguous commit and tolerates a post-ack local failure", async () => {
    const p = await player(),
      request = randomUUID();
    await databaseFailure(
      (sql) => sql === "COMMIT",
      async () => {
        const result = await db.mutate(p.id, request, (profile, tx) =>
          purchase(profile, tx, "capsule", 2, request),
        );
        expect(result.applied).toBe(true);
        expect(result.profile.balance).toBe(150);
        const retry = await db.mutate(p.id, request, () => {
          throw new Error("local replay must not apply");
        });
        expect(retry.applied).toBe(false);
        expect(retry.profile.inventory.capsule).toBe(10);
        expect(await sum(p.id)).toBe(150);
      },
    );
  });
  it("rejects ledger edits and reconciles cached balances", async () => {
    const p = await player();
    await expect(
      db.pool.query("UPDATE ledger SET amount=999 WHERE player_id=$1", [p.id]),
    ).rejects.toThrow("append only");
    await expect(
      db.pool.query("DELETE FROM ledger WHERE player_id=$1", [p.id]),
    ).rejects.toThrow("append only");
    expect(await sum(p.id)).toBe((await db.getProfile(p.id)).balance);
  });
  it("allows exactly one capture when different players race for the same encounter", async () => {
    const a = await player(),
      b = await player(),
      encounter = randomUUID();
    const capture = (p: Profile) =>
      db.mutate(p.id, randomUUID(), async (profile, tx) => {
        const creature = makeCreature("voltkit", 4);
        consume(profile, "capsule");
        await tx.capture(encounter, p.id, creature.id);
        profile.creatures.push(creature);
      });
    const results = await Promise.allSettled([capture(a), capture(b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const saved = await Promise.all([db.getProfile(a.id), db.getProfile(b.id)]);
    expect(saved.reduce((n, p) => n + p.creatures.length, 0)).toBe(1);
    expect(saved.reduce((n, p) => n + p.inventory.capsule, 0)).toBe(15);
  });
  it("completes capture after post-ack socket failure and reconciles stale world state", async () => {
    const { IslandRoom } = await import("../room.js");
    const profile = await player();
    const saved = await db.mutate(profile.id, randomUUID(), (p) => {
      const starter = makeCreature("brookfin");
      p.creatures.push(starter);
      p.team = [starter.id];
      p.active = starter.id;
      p.claimed.push("story-catch");
      p.quests["accepted:research-meadow"] = 1;
    });
    const client = {
      send: () => {
        throw new Error("socket closed after commit");
      },
    };
    const p = {
      client,
      profile: saved.profile,
      x: -12,
      z: -5,
      lastUse: 0,
      bait: false,
    } as unknown as import("../room.js").Player;
    const room = new IslandRoom() as unknown as {
      wilds: Map<string, unknown>;
      tame: (
        player: import("../room.js").Player,
        id: string,
        item: "capsule",
        request: string,
      ) => Promise<void>;
    };
    const wild = {
      id: "capture-test",
      species: "bulbasaur",
      level: 1,
      x: -12,
      z: -5,
      hp: 10,
      maxHp: 90,
      boss: false,
      elite: false,
      encounter: randomUUID(),
      contributors: new Map(),
      slowUntil: 0,
      stunUntil: 0,
      state: "idle",
    };
    room.wilds.set(wild.id, wild);
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);
    const logging = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await room.tame(p, wild.id, "capsule", randomUUID());
      expect(wild.hp).toBe(0);
      expect(wild.state).toBe("defeat");
      expect(p.profile.creatures).toHaveLength(2);
      expect(p.profile.quests["progress:research-meadow"]).toBe(1);
      expect(logging).toHaveBeenCalled();
      wild.hp = 10;
      wild.state = "idle";
      await room.tame(p, wild.id, "capsule", randomUUID());
      expect(wild.hp).toBe(0);
      expect(p.profile.creatures).toHaveLength(2);
      expect(p.profile.quests["progress:research-meadow"]).toBe(1);
      expect(p.profile.inventory.capsule).toBe(7);
      const durable = await db.getProfile(profile.id);
      expect(durable.quests["progress:research-meadow"]).toBe(1);
      expect(durable.quests["objective:research-meadow:bulbasaur"]).toBe(1);
    } finally {
      rng.mockRestore();
      logging.mockRestore();
    }
  });
  it("persists defeat, returns the trainer safely, and restores a fainted team through the real healing command", async () => {
    const { IslandRoom } = await import("../room.js");
    const { WORLD } = await import("../../../../packages/shared/data.js");
    const profile = await player();
    const initialized = await db.mutate(profile.id, randomUUID(), (p) => {
      const c = makeCreature("brookfin");
      c.hp = 1;
      p.heroHp = 1;
      p.creatures = [c];
      p.team = [c.id];
      p.active = c.id;
    });
    const send = vi.fn(),
      client = { sessionId: randomUUID(), send };
    const room = new IslandRoom();
    const runtime = room as unknown as {
      players: Map<string, import("../room.js").Player>;
      wildHit: (
        wild: unknown,
        p: import("../room.js").Player,
        attack: string,
        variant: number,
        kind: string,
      ) => Promise<void>;
      command: (
        p: import("../room.js").Player,
        command: unknown,
      ) => Promise<void>;
    };
    await room.onJoin(client as never, {}, initialized.profile);
    try {
      const p = runtime.players.get(profile.id)!;
      p.x = -25;
      p.z = 13;
      await runtime.wildHit(
        {
          id: "test-strike",
          encounter: randomUUID(),
          species: "cindercub",
          level: 2,
          elite: false,
          boss: false,
        },
        p,
        "Test strike",
        0,
        "telegraph",
      );
      expect((await db.getProfile(profile.id)).heroHp).toBe(0);
      expect({ x: p.x, z: p.z }).toEqual(WORLD.spawn);
      expect(p.combatUntil).toBe(0);
      p.x = -10;
      p.z = -29;
      await runtime.command(p, { kind: "heal", requestId: randomUUID() });
      const saved = await db.getProfile(profile.id);
      expect(saved.creatures[0].hp).toBe(saved.creatures[0].maxHp);
      expect(saved.balance).toBe(180);
      expect(send).toHaveBeenCalledWith(
        "event",
        expect.objectContaining({ type: "defeat" }),
      );
    } finally {
      await room.onDispose();
    }
  });
  it("atomically rejects duplicate team slots and foreign ownership", async () => {
    const p = await player();
    await expect(
      db.mutate(p.id, randomUUID(), (profile) => {
        profile.team = [randomUUID()];
      }),
    ).rejects.toThrow("Invalid team");
    const c = makeCreature("spriglet");
    await expect(
      db.mutate(p.id, randomUUID(), (profile) => {
        profile.creatures.push(c);
        profile.team = [c.id, c.id];
      }),
    ).rejects.toThrow("Invalid team");
    expect((await db.getProfile(p.id)).creatures).toHaveLength(0);
  });
  it("makes quest and repeated boss rewards idempotent across different request IDs", async () => {
    const p = await player();
    await db.mutate(p.id, randomUUID(), (profile) => {
      profile.quests.starter = 1;
    });
    await db.mutate(p.id, randomUUID(), (profile, tx) =>
      claimQuest(profile, tx, "first-friend"),
    );
    await expect(
      db.mutate(p.id, randomUUID(), (profile, tx) =>
        claimQuest(profile, tx, "first-friend"),
      ),
    ).rejects.toThrow("already collected");
    await Promise.all(
      Array.from({ length: 4 }, () =>
        db.mutate(p.id, randomUUID(), (profile, tx) =>
          tx.credit(profile, 180, "world boss", "boss:unique"),
        ),
      ),
    );
    expect((await db.getProfile(p.id)).balance).toBe(400);
  });
  it("persists accepted objectives and grants a story reward once under concurrent turn-ins", async () => {
    const p = await player();
    await db.mutate(p.id, randomUUID(), (profile) => {
      profile.creatures = [makeCreature("bulbasaur")];
      profile.claimed = ["first-friend"];
      acceptQuest(profile, "story-ranger", { x: 0, z: -22 });
      inspectStoryPlace(profile, "ranger");
    });
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        db.mutate(p.id, randomUUID(), (profile, tx) =>
          claimQuest(profile, tx, "story-ranger", { x: -30, z: 4 }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const saved = await db.getProfile(p.id);
    expect(saved.balance).toBe(205);
    expect(saved.claimed).toContain("story-ranger");
    expect(saved.quests["progress:story-ranger"]).toBe(1);
    expect(await sum(p.id)).toBe(saved.balance);
  });
  it("rolls back a quest field kit on failure and replays acceptance without duplicate supplies", async () => {
    const p = await player(),
      request = randomUUID();
    await db.mutate(p.id, randomUUID(), (profile) => {
      profile.creatures = [makeCreature("bulbasaur")];
      profile.claimed = ["story-satchel"];
    });
    await expect(
      db.mutate(p.id, request, (profile) => {
        acceptQuest(profile, "story-catch", { x: -30, z: 4 });
        throw new Error("crash before commit");
      }),
    ).rejects.toThrow("crash");
    expect(
      (await db.getProfile(p.id)).quests["accepted:story-catch"],
    ).toBeUndefined();
    expect((await db.getProfile(p.id)).inventory.capsule).toBe(8);
    await db.mutate(p.id, request, (profile) =>
      acceptQuest(profile, "story-catch", { x: -30, z: 4 }),
    );
    const replay = await db.mutate(p.id, request, () => {
      throw new Error("must not repeat");
    });
    expect(replay.applied).toBe(false);
    expect(replay.profile.inventory.capsule).toBe(16);
    expect(replay.profile.quests["accepted:story-catch"]).toBe(1);
  });
  it("advances the accepted finale through boss rewards and completes it exactly once", async () => {
    const { IslandRoom } = await import("../room.js");
    const p = await player();
    await db.mutate(p.id, randomUUID(), (profile) => {
      const creature = makeCreature("bulbasaur", 12);
      profile.creatures = [creature];
      profile.team = [creature.id];
      profile.active = creature.id;
      profile.claimed = ["story-beacon"];
      acceptQuest(profile, "story-storm", { x: 25, z: 16 });
    });
    const room = new IslandRoom() as unknown as {
      defeatWild: (wild: unknown) => Promise<void>;
    };
    const boss = {
      id: "stormheart",
      species: "tempest",
      level: 12,
      habitat: "sanctuary",
      boss: true,
      elite: false,
      hp: 1,
      maxHp: 1200,
      encounter: randomUUID(),
      contributors: new Map([[p.id, 60]]),
      threat: new Map(),
      auras: new Map(),
    };
    await room.defeatWild(boss);
    await room.defeatWild(boss);
    expect((await db.getProfile(p.id)).quests["progress:story-storm"]).toBe(1);
    await db.mutate(p.id, randomUUID(), (profile, tx) =>
      claimQuest(profile, tx, "story-storm", { x: 25, z: 16 }),
    );
    await expect(
      db.mutate(p.id, randomUUID(), (profile, tx) =>
        claimQuest(profile, tx, "story-storm", { x: 25, z: 16 }),
      ),
    ).rejects.toThrow("already collected");
    const saved = await db.getProfile(p.id);
    expect(saved.balance).toBe(580);
    expect(saved.quests.bosses).toBe(1);
    expect(await sum(p.id)).toBe(saved.balance);
  });
  it("returns both committed profiles after an ambiguous match acknowledgement and replays the durable winner", async () => {
    const a = await player(),
      b = await player(),
      id = randomUUID();
    await databaseFailure(
      (sql) => sql === "COMMIT",
      async () => {
        const result = await db.recordMatch(id, a.id, b.id, a.id, "defeat");
        expect(result.winner).toBe(a.id);
        expect(result.profiles.find((p) => p.id === a.id)?.balance).toBe(210);
        expect(result.profiles.find((p) => p.id === b.id)?.losses).toBe(1);
      },
    );
    const replay = await db.recordMatch(id, a.id, b.id, b.id, "timeout");
    expect(replay.winner).toBe(a.id);
    expect((await db.getProfile(a.id)).wins).toBe(1);
    expect(await sum(a.id)).toBe(210);
  });
  it("rolls back both participants at a match crash boundary and succeeds on retry", async () => {
    const a = await player(),
      b = await player(),
      id = randomUUID();
    await databaseFailure(
      (sql) => sql.startsWith("UPDATE players"),
      async () => {
        await expect(
          db.recordMatch(id, a.id, b.id, a.id, "defeat"),
        ).rejects.toThrow("injected database failure");
      },
    );
    expect(await db.history(a.id)).toHaveLength(0);
    expect((await db.getProfile(a.id)).wins).toBe(0);
    expect(await sum(a.id)).toBe(180);
    await db.recordMatch(id, a.id, b.id, a.id, "defeat");
    expect((await db.getProfile(a.id)).wins).toBe(1);
    const board = await db.leaderboard();
    expect(
      board.some((row) => row.nickname === a.nickname && row.wins === 1),
    ).toBe(true);
  });
  it("includes drawn-match participants but excludes unplayed profiles from rankings", async () => {
    const a = await player(),
      b = await player(),
      unplayed = await player();
    await db.recordMatch(randomUUID(), a.id, b.id, null, "timeout");
    const board = await db.leaderboard();
    for (const p of [a, b])
      expect(board).toContainEqual({
        nickname: p.nickname,
        wins: 0,
        losses: 0,
      });
    expect(board.some((row) => row.nickname === unplayed.nickname)).toBe(false);
  });
  it("records one result, prevents repeated-opponent reward farming and does not pay surrender", async () => {
    const a = await player(),
      b = await player(),
      id = randomUUID();
    await Promise.all([
      db.recordMatch(id, a.id, b.id, a.id, "defeat"),
      db.recordMatch(id, a.id, b.id, a.id, "defeat"),
    ]);
    for (let i = 0; i < 3; i++)
      await db.recordMatch(
        randomUUID(),
        a.id,
        b.id,
        a.id,
        i === 2 ? "surrender" : "defeat",
      );
    const replay = await db.recordMatch(id, a.id, b.id, b.id, "timeout");
    expect(replay.winner).toBe(a.id);
    expect(replay.reason).toBe("defeat");
    const saved = await db.getProfile(a.id);
    expect(saved.balance).toBe(240);
    expect(saved.wins).toBe(4);
    expect(await db.history(a.id)).toHaveLength(4);
    expect((await db.getProfile(b.id)).losses).toBe(4);
    expect(saved.quests.duels).toBe(4);
  });
  it("learns abilities during progression and caps at level twenty", () => {
    const c = makeCreature("spriglet");
    expect(c.moves).toHaveLength(2);
    gainExperience(c, 150);
    expect(c.level).toBe(3);
    expect(c.moves).toHaveLength(3);
    gainExperience(c, 100000);
    expect(c.level).toBe(20);
    expect(c.moves).toHaveLength(4);
    expect(c.hp).toBe(c.maxHp);
  });
});
