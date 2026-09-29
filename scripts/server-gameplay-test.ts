import assert from "node:assert/strict";
import { travel } from "./server-navigation.js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { SPECIES, SPAWNS, QUESTS } from "../packages/shared/data.js";
import { maxHp } from "../packages/shared/rules.js";
import { isSafeArea } from "../packages/shared/regions.js";
import { learnedMoves } from "../apps/server/src/gameplay.js";

const originalUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const namespace = `gameplay_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: originalUrl });
await admin.query(`CREATE SCHEMA ${namespace}`);
const testUrl = new URL(originalUrl);
testUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.DATABASE_URL = testUrl.toString();
const fixturePort = Number(process.env.GAMEPLAY_TEST_PORT ?? 2571);
process.env.SERVER_URL = `http://127.0.0.1:${fixturePort}`;
const { mutate, pool } = await import("../apps/server/src/db.js");
const { NetworkPlayer, delay, until, base } = await import(
  "./network-client.js"
);
const server = spawn(
  process.execPath,
  ["--import", "tsx", "apps/server/src/index.ts"],
  {
    env: { ...process.env, PORT: String(fixturePort), ALLOWED_ORIGINS: base },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += String(chunk)));
server.stderr.on("data", (chunk) => (serverLog += String(chunk)));
const players: InstanceType<typeof NetworkPlayer>[] = [];
const checks: { name: string; passed: boolean; detail?: string }[] = [];
const check = async (name: string, run: () => Promise<void>) => {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, detail: String(error) });
    console.error(`FAIL ${name}`, error);
    throw error;
  }
};
async function refill(p: InstanceType<typeof NetworkPlayer>) {
  if (p.self!.hp < p.self!.maxHp * 0.6) {
    const before = p.profile.inventory["super-potion"];
    p.send({ kind: "use", item: "super-potion" });
    await until(() => p.profile.inventory["super-potion"] < before);
    await delay(1700);
  }
}
try {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) break;
    } catch {}
    if (tries > 100) throw new Error("Isolated server failed to start");
    await delay(100);
  }
  const a = await NetworkPlayer.create("Gameplay A"),
    b = await NetworkPlayer.create("Gameplay B");
  players.push(a, b);
  await a.starter("brookfin");
  await b.starter("spriglet");
  for (const p of players) {
    await mutate(p.profile.id, randomUUID(), async (profile, tx) => {
      const c = profile.creatures[0];
      c.level = 20;
      c.maxHp = maxHp(c.species, 20);
      c.hp = c.maxHp;
      c.moves = learnedMoves(c.species, 20);
      profile.inventory = {
        ...profile.inventory,
        prism: 300,
        bait: 300,
        "super-potion": 200,
      };
      await tx.credit(
        profile,
        10000,
        "isolated test fixture",
        `fixture:${p.profile.id}`,
      );
    });
    await p.close();
    await p.join();
  }
  await check(
    "Two actual clients share isolated authoritative world",
    async () => {
      assert.equal(a.room.roomId, b.room.roomId);
      assert.notEqual(a.profile.id, b.profile.id);
    },
  );
  await check(
    "Starter ascension changes persisted stats; team and storage ownership are enforced",
    async () => {
      await travel(a, -18, -16);
      const before = a.profile.creatures[0].maxHp;
      a.send({ kind: "evolve", id: a.profile.active });
      await until(() => a.profile.creatures[0].evolved);
      assert(a.profile.creatures[0].maxHp > before);
      const errors = a.errors.length;
      a.send({ kind: "team", ids: [b.profile.active] });
      await until(() => a.errors.length > errors);
    },
  );
  await check(
    "All three Pokémon species are actually captured through server commands",
    async () => {
      for (const species of Object.values(SPECIES)
        .filter((s) => s.companion)
        .map((s) => s.id)) {
        const spawn = SPAWNS.find(
          (s) => s.species === species && !s.elite && !s.boss,
        )!;
        const wild = () => a.world!.wilds.find((w) => w.id === spawn.id)!;
        await travel(a, spawn.x + 4, spawn.z + 1);
        await refill(a);
        for (let attempts = 0; attempts < 35; attempts++) {
          const count = a.profile.creatures.filter(
            (c) => c.species === species,
          ).length;
          const baitBefore = a.profile.inventory.bait;
          a.send({ kind: "use", item: "bait" });
          await until(() => a.profile.inventory.bait < baitBefore);
          await delay(1700);
          const capsules = a.profile.inventory.prism;
          a.send({ kind: "tame", target: spawn.id, item: "prism" });
          await until(() => a.profile.inventory.prism < capsules);
          await delay(1650);
          if (
            a.profile.creatures.filter((c) => c.species === species).length >
            count
          ) {
            assert.equal(wild().hp, 0);
            console.log(`Tamed ${species} after ${attempts + 1} attempt(s)`);
            break;
          }
          if (attempts === 34) throw new Error(`Could not tame ${species}`);
        }
      }
      assert.equal(new Set(a.profile.creatures.map((c) => c.species)).size, 3);
      assert.equal(a.profile.team.length, 3);
      assert(a.profile.creatures.length > a.profile.team.length);
    },
  );
  await check(
    "Two real players contribute to a two-phase boss and receive one reward each",
    async () => {
      await Promise.all([travel(a, 6, 68), travel(b, 11, 67)]);
      await refill(a);
      await refill(b);
      const balanceA = a.profile.balance,
        balanceB = b.profile.balance;
      let sawPhaseTwo = false;
      const started = Date.now();
      while ((a.world!.wilds.find((w) => w.id === "stormheart")?.hp ?? 0) > 0) {
        if (Date.now() - started > 150000)
          throw new Error("Boss did not finish");
        for (const p of players) {
          const boss = p.world!.wilds.find((w) => w.id === "stormheart")!;
          if (boss.phase === 2) sawPhaseTwo = true;
          if (Math.hypot(p.self!.x - boss.x, p.self!.z - boss.z) > 13)
            await travel(p, boss.x + 3, boss.z - 5);
          p.send({ kind: "attack", target: "stormheart", slot: 0 });
        }
        await delay(1350);
        for (const p of players) await refill(p);
      }
      await until(
        () => a.profile.quests.bosses === 1 && b.profile.quests.bosses === 1,
      );
      assert(sawPhaseTwo);
      assert(a.profile.balance >= balanceA + 180);
      assert(b.profile.balance >= balanceB + 180);
      const saved = [a.profile.balance, b.profile.balance];
      for (const p of players)
        p.send({ kind: "attack", target: "stormheart", slot: 0 });
      await delay(500);
      assert.equal(a.profile.balance, saved[0]);
      assert.equal(b.profile.balance, saved[1]);
    },
  );
  await check(
    "Elite encounter rewards, eligible quest progression, and purchase complete",
    async () => {
      await travel(a, -27, 60);
      await refill(a);
      for (
        let tries = 0;
        a.world!.wilds.find((w) => w.id === "elite-ruins")!.hp > 0;
        tries++
      ) {
        if (tries > 50) throw new Error("Elite did not finish");
        a.send({ kind: "attack", target: "elite-ruins", slot: 0 });
        await delay(1300);
        await refill(a);
      }
      await until(() => (a.profile.quests.elites ?? 0) >= 1);
      while ((a.profile.quests.defeats ?? 0) < 20) {
        const target = a
          .world!.wilds.filter((w) => w.hp > 0 && !w.elite && !w.boss)
          .sort(
            (x, y) =>
              Math.hypot(x.x - a.self!.x, x.z - a.self!.z) -
              Math.hypot(y.x - a.self!.x, y.z - a.self!.z),
          )[0];
        if (!target) {
          await delay(1000);
          continue;
        }
        await refill(a);
        for (
          let tries = 0;
          (a.world!.wilds.find((w) => w.id === target.id)?.hp ?? 0) > 0;
          tries++
        ) {
          if (tries > 35)
            throw new Error(
              `Could not defeat ${target.id}: ${JSON.stringify(a.errors.slice(-3))}`,
            );
          // Close in only when out of spell range or inside a sanctuary, never through the creature.
          const now = a.world!.wilds.find((w) => w.id === target.id)!;
          if (
            Math.hypot(now.x - a.self!.x, now.z - a.self!.z) > 14 ||
            isSafeArea(a.self!.x, a.self!.z)
          )
            await travel(a, now.x + 4, Math.max(-10, now.z - 4));
          a.send({ kind: "attack", target: target.id, slot: 0 });
          await delay(1350);
          await refill(a);
        }
      }
      await travel(a, 10, -29);
      a.send({ kind: "buy", item: "capsule", quantity: 1 });
      await until(() => (a.profile.quests.purchases ?? 0) >= 1);
      for (const quest of QUESTS.filter(
        (q) => !q.repeatable && q.id !== "friendly-rival",
      )) {
        if (
          (a.profile.quests[quest.key] ?? 0) < quest.goal ||
          (quest.prerequisite &&
            !a.profile.claimed.includes(quest.prerequisite))
        )
          continue;
        a.send({ kind: "claim", quest: quest.id });
        await until(() => a.profile.claimed.includes(quest.id));
      }
      assert(a.profile.claimed.includes("coast-path"));
    },
  );
  await check(
    "Collection, evolution, boss attribution and balances survive reconnect; ledger reconciles",
    async () => {
      const saved = structuredClone(a.profile);
      await a.close();
      await a.join();
      assert.deepEqual(a.profile, saved);
      const total = Number(
        (
          await pool.query(
            "SELECT sum(amount) AS total FROM ledger WHERE player_id=$1",
            [a.profile.id],
          )
        ).rows[0].total,
      );
      assert.equal(a.profile.balance, total);
      const bossEntries = await pool.query(
        "SELECT player_id,COUNT(*)::int AS count FROM ledger WHERE reason='world boss' GROUP BY player_id",
      );
      assert.equal(bossEntries.rowCount, 2);
      assert(bossEntries.rows.every((row) => row.count === 1));
    },
  );
} catch (error) {
  if (!checks.some((c) => !c.passed))
    checks.push({
      name: "fixture setup",
      passed: false,
      detail: String(error),
    });
  process.exitCode = 1;
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  await writeFile(
    "evidence/server-gameplay-test.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        server: base,
        method:
          "Two actual Colyseus clients against isolated server and PostgreSQL schema. Fixture profiles level20 with supplies; movement, capture RNG, damage, rewards, quests and ascension use production command paths.",
        checks,
        players: players.map((p) => ({
          id: p.profile.id,
          species: [...new Set(p.profile.creatures.map((c) => c.species))],
          bosses: p.profile.quests.bosses,
          balance: p.profile.balance,
        })),
        errors: players.map((p) => p.errors),
      },
      null,
      2,
    ),
  );
  await writeFile("evidence/server-gameplay-test.log", serverLog);
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
