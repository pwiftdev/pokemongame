import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { travel } from "./server-navigation.js";
import { pokemonAvailable } from "../packages/shared/pokemon-habitats.js";

const original =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const schema = `pokemon_${randomUUID().replaceAll("-", "")}`,
  admin = new pg.Pool({ connectionString: original });
await admin.query(`CREATE SCHEMA ${schema}`);
const url = new URL(original);
url.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const port = Number(process.env.POKEMON_TEST_PORT ?? 2574);
process.env.SERVER_URL = `http://127.0.0.1:${port}`;
const { NetworkPlayer, until, delay, base } = await import(
  "./network-client.js"
);
const { mutate, pool } = await import("../apps/server/src/db.js");
const { makeCreature } = await import("../apps/server/src/gameplay.js");
const server = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/pokemon-clock.mjs",
    "--import",
    "tsx",
    "apps/server/src/index.ts",
  ],
  {
    env: { ...process.env, PORT: String(port), ALLOWED_ORIGINS: base },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "";
server.stdout.on("data", (data) => (log += data));
server.stderr.on("data", (data) => (log += data));
let player: InstanceType<typeof NetworkPlayer> | undefined;
const checks: { name: string; passed: boolean; detail?: string }[] = [];
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, detail: String(error) });
    throw error;
  }
}
async function fixture(edit: Parameters<typeof mutate>[2]) {
  const p = player!;
  await p.close();
  await delay(250);
  await mutate(p.profile.id, randomUUID(), edit);
  p.world = undefined;
  await p.join("new");
  p.send({ kind: "pet", mode: "passive" });
}
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (i > 100) throw Error("Server startup failed");
    await delay(100);
  }
  player = await NetworkPlayer.create("Pokémon systems", undefined, "new");
  const p = player;
  await p.starter();
  await check(
    "nighttime Pokémon appear when authoritative world time changes",
    async () => {
      assert.equal(p.world!.conditions!.time, "day");
      assert.equal(
        p.world!.wilds.find((w) => w.id === "pokemon-cleffa-0")!.hp,
        0,
      );
      await until(() => p.world?.conditions?.time === "night", 15000);
      await until(
        () =>
          (p.world!.wilds.find((w) => w.id === "pokemon-cleffa-0")?.hp ?? 0) >
          0,
        3000,
      );
      assert(pokemonAvailable("cleffa", p.world!.time));
    },
  );
  await check(
    "sleepy Pokémon nap while playful Pokémon move between peers",
    async () => {
      await until(() =>
        p.world!.wilds.some((w) => w.hp > 0 && w.activity === "sleep"),
      );
      const playful = p.world!.wilds.find(
        (w) => w.hp > 0 && w.activity === "play",
      );
      assert(playful);
      const origin = { x: playful.x, z: playful.z };
      await until(() => {
        const current = p.world!.wilds.find((w) => w.id === playful.id)!;
        return Math.hypot(current.x - origin.x, current.z - origin.z) > 0.5;
      }, 6000);
      assert(!p.world!.wilds.find((w) => w.activity === "sleep")?.target);
    },
  );
  await fixture((profile) => {
    const a = makeCreature("bulbasaur", 12),
      b = makeCreature("charmander", 12),
      c = makeCreature("squirtle", 12);
    a.moves = ["pk-tackle", "pk-vine-whip", "pk-synthesis", "pk-razor-leaf"];
    profile.creatures = [a, b, c];
    profile.team = [a.id, b.id, c.id];
    profile.active = a.id;
    profile.inventory = { capsule: 30, bait: 30, revive: 10, potion: 10 };
    profile.balance = 1000;
    profile.heroHp = undefined;
  });
  await check(
    "quick swap changes the deployed Pokémon and rejects repeated cooldown bypass",
    async () => {
      p.send({ kind: "swap", slot: 1 });
      await until(() => p.profile.active === p.profile.team[1]);
      const mark = p.errors.length;
      p.send({ kind: "swap", slot: 0 });
      await until(() => p.errors.length > mark);
      assert(p.events.some((e) => e.type === "pet-swap"));
    },
  );
  await fixture((profile) => {
    profile.active = profile.team[0];
  });
  await travel(p, -43, 3);
  await check(
    "companion chooses a ready move and resolves through the shared damage path",
    async () => {
      const mark = p.events.length;
      p.send({ kind: "pet", mode: "attack", target: "sprig-1" });
      await until(
        () =>
          p.events
            .slice(mark)
            .some(
              (e) =>
                e.actor === "companion" &&
                e.type === "impact" &&
                (e.amount ?? 0) > 0,
            ),
        15000,
      );
      assert(
        p.events
          .slice(mark)
          .some((e) => e.type === "pet-cast" && e.ability?.startsWith("pk-")),
      );
      p.send({ kind: "pet", mode: "passive" });
    },
  );
  await check(
    "player-commanded move uses the selected slot and exposes its cooldown",
    async () => {
      const mark = p.events.length;
      p.send({ kind: "petMove", slot: 1, target: "sprig-2" });
      await until(
        () =>
          p.events
            .slice(mark)
            .some((e) => e.type === "pet-cast" && e.ability === "pk-vine-whip"),
        12000,
      );
      await until(
        () => (p.self?.pet?.cooldowns["pk-vine-whip"] ?? 0) > p.world!.time,
      );
      p.send({ kind: "pet", mode: "passive" });
    },
  );
  await fixture((profile) => {
    const c = profile.creatures[0];
    c.hp = 1;
    c.moves = ["pk-growth"];
    profile.heroHp = undefined;
  });
  await travel(p, 51, 26);
  await check(
    "companion takes real enemy hits, faints, persists and revives",
    async () => {
      p.send({ kind: "pet", mode: "attack", target: "moss-1" });
      await until(() => p.self?.pet?.hp === 0, 25000, "companion faint");
      p.send({ kind: "pet", mode: "passive" });
      await until(() => p.profile.creatures[0].hp === 0, 4000);
      assert(p.events.some((e) => e.type === "pet-faint"));
      p.send({ kind: "use", item: "revive" });
      await until(() => p.profile.creatures[0].hp > 0);
      await travel(p, 30, 7);
    },
  );
  await fixture((profile) => {
    profile.creatures[0].moves = [
      "pk-tackle",
      "pk-vine-whip",
      "pk-growth",
      "pk-razor-leaf",
    ];
    profile.heroHp = undefined;
  });
  await travel(p, -59, 33);
  await check(
    "curious wild Pokémon approach and inspect without creating threat",
    async () => {
      await until(
        () =>
          p.world!.wilds.some(
            (w) =>
              w.id.startsWith("bulbasaur-grove") && w.activity === "inspect",
          ),
        8000,
      );
      assert(!p.world!.wilds.find((w) => w.id === "bulbasaur-grove")?.target);
    },
  );
  await check(
    "capture sends server-decided shakes, break-out and saved success",
    async () => {
      let success = false,
        failure = false;
      for (let i = 0; i < 20 && (!success || !failure); i++) {
        const wild = p.world!.wilds.find(
          (w) => w.species === "bulbasaur" && w.hp > 0,
        );
        if (!wild) {
          await fixture(() => {});
          continue;
        }
        await travel(p, wild.x + 6, wild.z);
        p.send({ kind: "use", item: "bait" });
        await delay(1700);
        const mark = p.events.length,
          requestId = randomUUID();
        p.send({ kind: "tame", item: "capsule", target: wild.id, requestId });
        await until(() => p.events.slice(mark).some((e) => !!e.capture), 4000);
        const event = p.events.slice(mark).find((e) => !!e.capture)!;
        assert(event.capture!.shakes >= 1 && event.capture!.shakes <= 3);
        success ||= event.capture!.success;
        failure ||= !event.capture!.success;
        if (event.capture!.success)
          assert(
            p.profile.creatures.some((c) => c.id === event.capture!.creatureId),
          );
        const count = p.profile.inventory.capsule;
        p.send({ kind: "tame", item: "capsule", target: wild.id, requestId });
        await delay(300);
        assert.equal(p.profile.inventory.capsule, count);
        await delay(1900);
      }
      assert(success && failure, "observed both authoritative outcomes");
    },
  );
  await fixture((profile) => {
    profile.active = profile.team[0];
    profile.heroHp = undefined;
  });
  await travel(p, -16, -16);
  await check(
    "evolution changes species and stats once through a durable command",
    async () => {
      const id = p.profile.active!,
        before = p.profile.creatures.find((c) => c.id === id)!,
        hp = before.maxHp,
        balance = p.profile.balance,
        requestId = randomUUID();
      p.send({ kind: "evolve", id, requestId });
      await until(
        () =>
          p.profile.creatures.find((c) => c.id === id)?.species === "ivysaur",
      );
      assert(p.profile.creatures.find((c) => c.id === id)!.maxHp > hp);
      assert.equal(p.profile.balance, balance - 90);
      assert(p.events.some((e) => e.evolution?.to === "ivysaur"));
      p.send({ kind: "evolve", id, requestId });
      await delay(300);
      assert.equal(p.profile.balance, balance - 90);
    },
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  if (!checks.some((c) => !c.passed))
    checks.push({ name: "setup", passed: false, detail: String(error) });
} finally {
  if (player) await player.close().catch(() => {});
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/pokemon-systems-test.json",
    JSON.stringify(
      {
        checks,
        errors: player?.errors,
        method:
          "Isolated PostgreSQL schema and actual Colyseus commands. Node-only clock preload advances through dusk; no test endpoint or client-authoritative action.",
      },
      null,
      2,
    ),
  );
  await writeFile("evidence/pokemon-systems-test.log", log);
  server.kill("SIGTERM");
  await new Promise<void>((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", () => resolve()),
  );
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
