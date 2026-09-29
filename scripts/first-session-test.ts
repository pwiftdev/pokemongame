import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { ABILITIES, QUESTS, SPECIES } from "../packages/shared/data.js";
import { distance } from "../packages/shared/rules.js";
import { travel } from "./server-navigation.js";
import type { NetworkPlayer as Player } from "./network-client.js";

const originalUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const namespace = `journey_${randomUUID().replaceAll("-", "")}`,
  admin = new pg.Pool({ connectionString: originalUrl });
await admin.query(`CREATE SCHEMA ${namespace}`);
const databaseUrl = new URL(originalUrl);
databaseUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.SERVER_URL = "http://127.0.0.1:2570";
const { NetworkPlayer, delay, until, base } = await import(
  "./network-client.js"
);
const audit = new pg.Pool({ connectionString: databaseUrl.toString() });
const server = spawn(
  process.execPath,
  ["--import", "tsx", "apps/server/src/index.ts"],
  {
    env: {
      ...process.env,
      PORT: "2570",
      DATABASE_URL: databaseUrl.toString(),
      ALLOWED_ORIGINS: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "";
server.stdout.on("data", (data) => (log += String(data)));
server.stderr.on("data", (data) => (log += String(data)));
const players: Player[] = [],
  checks: { name: string; passed: boolean; minute: number; detail?: string }[] =
    [],
  started = Date.now();
const elapsed = () => +((Date.now() - started) / 60000).toFixed(2);
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    checks.push({ name, passed: true, minute: elapsed() });
    console.log(`PASS (${elapsed()}min) ${name}`);
  } catch (error) {
    checks.push({
      name,
      passed: false,
      minute: elapsed(),
      detail: String(error),
    });
    throw error;
  }
};
const cooldowns = new Map<string, number>();
const recoveryLog: { player: string; minute: number; reason: string }[] = [];
const active = (p: Player) =>
  p.profile.creatures.find((c) => c.id === p.profile.active)!;
function ability(
  p: Player,
  effect: "basic" | "guard" | "heal" | "special",
  target: string,
) {
  const c = active(p),
    slot =
      effect === "basic"
        ? 0
        : effect === "special"
          ? c.moves.findIndex(
              (id) => ABILITIES[id].power > 0 && id !== c.moves[0],
            )
          : c.moves.findIndex((id) => ABILITIES[id].effect === effect);
  if (slot < 0) return;
  const move = ABILITIES[c.moves[slot]],
    key = `${p.profile.id}:${move.id}`,
    now = Date.now();
  if (now < (cooldowns.get(key) ?? 0)) return;
  p.send({ kind: "attack", slot, target });
  cooldowns.set(key, now + move.cooldown * 1000 + 120);
}
async function claims(p: Player) {
  for (const q of QUESTS) {
    if (
      p.profile.claimed.includes(q.id) ||
      q.id === "friendly-rival" ||
      (q.prerequisite && !p.profile.claimed.includes(q.prerequisite)) ||
      (p.profile.quests[q.key] ?? 0) < q.goal
    )
      continue;
    p.send({ kind: "claim", quest: q.id });
    await until(() => p.profile.claimed.includes(q.id));
  }
}
async function support(p: Player, target: string) {
  if (active(p).hp === 0) {
    await town([p], false);
    return true;
  }
  ability(p, "guard", target);
  const c = active(p);
  if (c.hp < c.maxHp * 0.85) ability(p, "heal", target);
  if (c.hp < c.maxHp * 0.45) {
    const item =
      (p.profile.inventory["super-potion"] ?? 0) > 0
        ? "super-potion"
        : "potion";
    if ((p.profile.inventory[item] ?? 0) > 0) {
      const before = p.profile.inventory[item];
      p.send({ kind: "use", item });
      await until(() => p.profile.inventory[item] < before, 3000);
      await delay(1100);
    } else {
      await town([p], false);
      return true;
    }
  }
  if (active(p).hp === 0) {
    await town([p], false);
    return true;
  }
}
async function battle(group: Player[], id: string) {
  const wild = () => group[0].world!.wilds.find((w) => w.id === id)!;
  const start = Date.now();
  const enemy = wild();
  await Promise.all(
    group.map((p, index) =>
      travel(p, enemy.x + (index ? 5 : -5), Math.max(enemy.z - 4, -10)),
    ),
  );
  const engagementStarted = Date.now();
  while (wild().hp > 0) {
    if (Date.now() - start > 150000) throw new Error(`Battle timeout ${id}`);
    for (const p of group) {
      const target = p.world!.wilds.find((w) => w.id === id)!;
      if (distance(p.self!, target) > 14)
        await travel(p, target.x + 3, Math.max(target.z - 5, -10));
      if (await support(p, id)) continue;
      ability(p, "basic", id);
      if (target.hp > 75 && Date.now() - engagementStarted > 1500)
        ability(p, "special", id);
    }
    await delay(180);
  }
  await delay(180);
  await Promise.all(group.map(claims));
  console.log(
    `Battle ${id}: ${group.map((p) => `${p.profile.nickname} Lv${active(p).level} HP${active(p).hp}/${active(p).maxHp}`).join("; ")}`,
  );
}
async function capture(p: Player, id: string) {
  const wild = () => p.world!.wilds.find((w) => w.id === id)!;
  const species = wild().species,
    owned = p.profile.creatures.length,
    start = Date.now();
  let restocks = 0;
  for (
    let tries = 0;
    tries < 25 && p.profile.creatures.length === owned;
    tries++
  ) {
    if (Date.now() - start > 240000) throw new Error(`Capture timed out ${id}`);
    if ((p.profile.inventory.capsule ?? 0) <= 0) {
      if (++restocks > 2)
        throw new Error("Repeated capsule supplies exhausted");
      await town([p], true, 20);
    }
    await support(p, id);
    await travel(p, wild().x + 4, Math.max(wild().z - 3, -10));
    const weakeningStarted = Date.now();
    while (wild().hp / wild().maxHp > 0.55) {
      if (Date.now() - weakeningStarted > 60000)
        throw new Error(
          `Could not weaken ${id}: ${p.errors.slice(-3).join("; ")}`,
        );
      if (await support(p, id)) {
        await travel(p, wild().x + 4, Math.max(wild().z - 3, -10));
        continue;
      }
      ability(p, "basic", id);
      await delay(1400);
    }
    if (wild().hp <= 0)
      throw new Error(`Capture target defeated unexpectedly: ${id}`);
    if (await support(p, id)) continue;
    const before = p.profile.inventory.capsule;
    await delay(1600);
    p.send({ kind: "tame", target: id, item: "capsule" });
    await until(() => p.profile.inventory.capsule < before);
    await delay(1600);
  }
  assert.equal(p.profile.creatures.length, owned + 1);
  await claims(p);
  console.log(
    `Tamed ${SPECIES[species].name}: ${p.profile.nickname} has ${p.profile.quests.captures} captures,${p.profile.inventory.capsule} capsules`,
  );
}
async function town(group: Player[], shopping = true, capsuleTarget = 12) {
  for (const p of group)
    if (active(p).hp === 0)
      recoveryLog.push({
        player: p.profile.nickname,
        minute: elapsed(),
        reason:
          "Fainted companion restored through the normal Springhouse action.",
      });
  await Promise.all(group.map((p) => travel(p, -10, -29)));
  await delay(8200);
  for (const p of group) {
    p.send({ kind: "heal" });
    await until(() => active(p).hp === active(p).maxHp);
    if (shopping) {
      await travel(p, 10, -29);
      for (const [item, quantity] of [
        [
          "capsule",
          Math.max(0, capsuleTarget - (p.profile.inventory.capsule ?? 0)),
        ],
        ["potion", Math.max(0, 5 - (p.profile.inventory.potion ?? 0))],
      ] as const) {
        if (!quantity) continue;
        const before = p.profile.inventory[item] ?? 0;
        p.send({ kind: "buy", item, quantity });
        await until(
          () => (p.profile.inventory[item] ?? 0) >= before + quantity,
        );
      }
      await claims(p);
    }
  }
}
let ledgerRows: unknown[] = [];
try {
  for (let tries = 0; ; tries++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (tries > 100) throw new Error("Server failed to start");
    await delay(100);
  }
  const a = await NetworkPlayer.create("First Journey A"),
    b = await NetworkPlayer.create("First Journey B");
  players.push(a, b);
  await check(
    "Fresh identities use only normal welcome funds and inventories",
    async () => {
      for (const p of players) {
        assert.equal(p.profile.balance, 180);
        assert.equal(p.profile.inventory.capsule, 8);
        assert.equal(p.profile.inventory.potion, 3);
        await p.starter("brookfin");
        await claims(p);
      }
      assert.equal(a.room.roomId, b.room.roomId);
    },
  );
  await check(
    "Onboarding battle, first capture, and normal shop transaction",
    async () => {
      await battle(players, "cinder-1");
      await capture(a, "sprig-1");
      await capture(b, "brook-1");
      await town(players);
      assert(players.every((p) => p.profile.claimed.includes("provisions")));
    },
  );
  await check(
    "Both trainers discover the forest and tame three companions",
    async () => {
      await Promise.all(players.map((p) => travel(p, 20, 3)));
      await Promise.all(
        players.map((p) =>
          until(() => p.profile.discoveries.includes("forest")),
        ),
      );
      await Promise.all(players.map(claims));
      await capture(a, "sprig-2");
      await capture(b, "brook-2");
      await capture(a, "pebble-1");
      await capture(b, "pebble-2");
      await town(players);
      assert(players.every((p) => p.profile.claimed.includes("field-notes")));
    },
  );
  await check(
    "Normal battle XP raises both starters to level six",
    async () => {
      let count = 0;
      while (players.some((p) => active(p).level < 6)) {
        if (++count > 30)
          throw new Error("Level six grind exceeded30encounters");
        const candidates = a
          .world!.wilds.filter(
            (w) => w.hp > 0 && !w.elite && !w.boss && w.level <= 5,
          )
          .sort(
            (x, y) =>
              (x.species === "cindercub" ? -30 : 0) +
              distance(a.self!, x) -
              ((y.species === "cindercub" ? -30 : 0) + distance(a.self!, y)),
          );
        await battle(players, candidates[0].id);
        if (
          players.some(
            (p) =>
              active(p).hp < active(p).maxHp * 0.4 ||
              (p.profile.inventory.potion ?? 0) < 1,
          )
        )
          await town(players);
      }
      assert(players.every((p) => active(p).level >= 6));
    },
  );
  await check(
    "Coastal discovery opens the authored midgame expedition",
    async () => {
      await Promise.all(players.map((p) => travel(p, -15, 49)));
      await Promise.all(
        players.map((p) =>
          until(() => p.profile.discoveries.includes("ruins")),
        ),
      );
      await Promise.all(players.map(claims));
      assert(players.every((p) => p.profile.claimed.includes("coast-path")));
      for (const p of players) {
        const errors = p.errors.length;
        p.send({ kind: "claim", quest: "elite-watch" });
        await until(() => p.errors.length > errors);
        assert(!p.profile.claimed.includes("elite-watch"));
      }
    },
  );
  await check(
    "Both trainers earn twenty real victories across varied species",
    async () => {
      const visited = new Set<string>();
      let attempts = 0;
      while (players.some((p) => (p.profile.quests.defeats ?? 0) < 20)) {
        if (++attempts > 35)
          throw new Error("Steward objective exceeded bounded encounter count");
        const candidates = a
          .world!.wilds.filter((w) => w.hp > 0 && !w.elite && !w.boss)
          .sort(
            (x, y) =>
              (visited.has(x.species) ? 100 : 0) +
              distance(a.self!, x) -
              ((visited.has(y.species) ? 100 : 0) + distance(a.self!, y)),
          );
        if (!candidates.length) {
          await delay(2000);
          continue;
        }
        visited.add(candidates[0].species);
        await battle(players, candidates[0].id);
        if (
          players.some(
            (p) =>
              active(p).hp < active(p).maxHp * 0.4 ||
              (p.profile.inventory.potion ?? 0) < 1,
          )
        )
          await town(players);
      }
      assert(
        players.every((p) => p.profile.claimed.includes("wildlands-steward")),
      );
      assert(visited.size >= 6);
    },
  );
  await check(
    "Both trainers complete ten actual captures with normal shop supplies",
    async () => {
      await town(players, true, 20);
      for (const p of players) {
        if (active(p).hp === 0) await town([p], false);
        let attempts = 0;
        while ((p.profile.quests.captures ?? 0) < 10) {
          if (++attempts > 20)
            throw new Error("Survey exceeded bounded capture count");
          if ((p.profile.inventory.capsule ?? 0) < 8) await town([p], true, 20);
          const candidates = p
            .world!.wilds.filter((w) => w.hp > 0 && !w.elite && !w.boss)
            .sort(
              (x, y) =>
                (p.profile.creatures.some((c) => c.species === x.species)
                  ? 100
                  : 0) +
                distance(p.self!, x) -
                ((p.profile.creatures.some((c) => c.species === y.species)
                  ? 100
                  : 0) +
                  distance(p.self!, y)),
            );
          if (!candidates.length) {
            await delay(2000);
            continue;
          }
          await capture(p, candidates[0].id);
        }
        await town([p], false);
      }
      assert(players.every((p) => p.profile.claimed.includes("long-survey")));
    },
  );
  await check(
    "A real elite defeat completes the expanded midgame chain",
    async () => {
      await battle(players, "elite-meadow");
      assert(players.every((p) => p.profile.claimed.includes("elite-watch")));
    },
  );
  await check(
    "Both starters ascend using earned PD and purchase boss supplies",
    async () => {
      await town(players, false);
      for (const p of players) {
        await travel(p, -16, -16);
        p.send({ kind: "evolve", id: p.profile.active });
        await until(() => active(p).evolved);
        await claims(p);
        await travel(p, 10, -29);
        const before = p.profile.inventory["super-potion"] ?? 0;
        p.send({ kind: "buy", item: "super-potion", quantity: 4 });
        await until(
          () => (p.profile.inventory["super-potion"] ?? 0) === before + 4,
        );
      }
      assert(players.every((p) => p.profile.claimed.includes("ascension")));
    },
  );
  await check(
    "Both ordinarily progressed players defeat the cooperative boss and finish the story",
    async () => {
      await battle(players, "stormheart");
      await Promise.all(players.map(claims));
      assert(players.every((p) => p.profile.claimed.includes("world-heart")));
      assert(players.every((p) => p.profile.quests.bosses === 1));
    },
  );
  await check(
    "All earned money reconciles and saved progression survives reconnect",
    async () => {
      for (const p of players) {
        const saved = structuredClone(p.profile);
        await p.close();
        await p.join();
        assert.deepEqual(p.profile, saved);
        const entries = await audit.query(
          "SELECT amount,reason,reference FROM ledger WHERE player_id=$1",
          [p.profile.id],
        );
        assert.equal(
          entries.rows.reduce((sum, row) => sum + row.amount, 0),
          p.profile.balance,
        );
        assert(
          !entries.rows.some((row) => String(row.reason).includes("fixture")),
        );
        ledgerRows.push({ player: p.profile.nickname, entries: entries.rows });
      }
    },
  );
} catch (error) {
  console.error(error);
  if (!checks.some((c) => !c.passed))
    checks.push({
      name: "setup",
      passed: false,
      minute: elapsed(),
      detail: String(error),
    });
  process.exitCode = 1;
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  await writeFile(
    "evidence/first-session-test.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        measuredMinutes: elapsed(),
        method:
          "Two actual network clients and fresh guest accounts. No player/profile/inventory/XP/currency database writes or admin commands. Database connection only creates/drops isolated schema and reads ledger reconciliation. Automated efficient navigation/combat timings; not representative human reading/exploration duration.",
        checks,
        players: players.map((p) => ({ profile: p.profile, errors: p.errors })),
        ledger: ledgerRows,
        recoveries: recoveryLog,
      },
      null,
      2,
    ),
  );
  await writeFile("evidence/first-session-test.log", log);
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  await audit.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
