import { createWalletSession } from "./wallet-client.js";
import { defaultLoadout } from "../packages/shared/skillbook.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import type { ClassId } from "../packages/shared/classes.js";
import { maxHp } from "../packages/shared/rules.js";
import { learnedMoves } from "../apps/server/src/gameplay.js";
import { travel } from "./server-navigation.js";

/**
 * Network verification of MMO combat systems against an isolated server and
 * schema: class resources, the global cooldown, level-gated abilities, auto
 * attacks, combo finishers, damage over time, interrupts, taunts and threat,
 * shatter combos and out-of-combat regeneration.
 */
const originalUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const namespace = `combat_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: originalUrl });
await admin.query(`CREATE SCHEMA ${namespace}`);
const testUrl = new URL(originalUrl);
testUrl.searchParams.set("options", `-c search_path=${namespace}`);
process.env.DATABASE_URL = testUrl.toString();
const port = Number(process.env.COMBAT_TEST_PORT ?? 2577);
process.env.SERVER_URL = `http://127.0.0.1:${port}`;
const { mutate, pool } = await import("../apps/server/src/db.js");
const { NetworkPlayer, delay, until, base } = await import(
  "./network-client.js"
);
type Player = InstanceType<typeof NetworkPlayer>;
const server = spawn(
  process.execPath,
  ["--import", "tsx", "apps/server/src/index.ts"],
  {
    env: { ...process.env, PORT: String(port), ALLOWED_ORIGINS: base },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += String(chunk)));
server.stderr.on("data", (chunk) => (serverLog += String(chunk)));
const players: Player[] = [];
const checks: { name: string; passed: boolean; detail?: string }[] = [];
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, detail: String(error) });
    console.error(`FAIL ${name}`, error);
    throw error;
  }
}
async function hero(name: string, classId: ClassId, room: string, level = 10) {
  const p = await NetworkPlayer.create(
    name,
    (await createWalletSession(base, name)).token,
    room,
  );
  players.push(p);
  p.send({ kind: "starter", species: "bulbasaur", classId });
  await until(() => p.profile.creatures.length > 0);
  if (level > 1) {
    await mutate(p.profile.id, randomUUID(), (profile) => {
      const c = profile.creatures[0];
      c.level = level;
      c.maxHp = maxHp(c.species, level);
      c.hp = c.maxHp;
      c.moves = learnedMoves(c.species, level);
      profile.heroHp = undefined;
    });
    const roomId = p.room.roomId;
    await p.close();
    await p.join(roomId);
  }
  p.send({ kind: "pet", mode: "passive" });
  return p;
}

const slots = (p: Player) =>
  p.profile.combat?.slots ??
  defaultLoadout(p.profile.classId, p.self?.skillLevel ?? 1).slots;
function cast(
  p: Player,
  id: string,
  target = p.profile.id,
  requestId = randomUUID(),
) {
  const slot = slots(p).indexOf(id);
  assert(slot >= 0, `${id} is equipped`);
  p.send({ kind: "attack", target, slot, requestId });
}
async function ready(p: Player) {
  await until(
    () =>
      (p.self?.gcdUntil ?? 0) < Date.now() &&
      !p.self?.cast &&
      !p.self?.mobility,
    5000,
  );
}
async function rejected(
  p: Player,
  command: Parameters<Player["send"]>[0],
  pattern: RegExp,
) {
  const mark = p.errors.length;
  p.send(command);
  await until(() => p.errors.length > mark);
  assert.match(p.errors[mark], pattern);
}
try {
  for (let tries = 0; ; tries++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (tries > 100) throw new Error("Isolated server failed to start");
    await delay(100);
  }
  const fresh = await hero("Fresh Rogue", "rogue", "new", 1),
    room = fresh.room.roomId;
  await check(
    "New heroes have one ability; locked and foreign loadouts are rejected",
    async () => {
      assert.deepEqual(slots(fresh), ["stab", null, null, null, null, null]);
      for (const skill of ["vanish", "blink", "stab"])
        await rejected(
          fresh,
          {
            kind: "combatLoadout",
            slots: ["stab", skill, null, null, null, null],
            layout: "row",
            labels: true,
          },
          /unlocked/,
        );
      await rejected(
        fresh,
        { kind: "attack", slot: 1, target: fresh.profile.id },
        /ability/i,
      );
    },
  );
  const mage = await hero("Blink Mage", "mage", room),
    rogue = await hero("Vanish Rogue", "rogue", room);
  const knight = await hero("Charging Knight", "knight", room),
    warrior = await hero("Charging Warrior", "barbarian", room);
  await check("Custom slots and bar style persist on reconnect", async () => {
    const config = {
      slots: [
        "blink",
        "firebolt",
        "meteor",
        "arcane-barrage",
        "frostbolt",
        "counterspell",
      ],
      layout: "split" as const,
      labels: false,
    };
    mage.send({ kind: "combatLoadout", ...config });
    await until(() => mage.profile.combat?.slots[0] === "blink");
    await mage.close();
    mage.world = undefined;
    await mage.join(room);
    assert.deepEqual(mage.profile.combat, config);
  });
  await check(
    "Blink moves on the server, respects cooldowns and replayed requests",
    async () => {
      await travel(mage, -12, -5);
      mage.stop();
      await delay(150);
      const from = { x: mage.self!.x, z: mage.self!.z },
        requestId = randomUUID();
      cast(mage, "blink", mage.profile.id, requestId);
      await until(() =>
        mage.events.some((e) => e.type === "mobility" && e.ability === "blink"),
      );
      await delay(200);
      assert(Math.hypot(mage.self!.x - from.x, mage.self!.z - from.z) > 8);
      const untilCooldown = mage.self!.cooldowns!.blink;
      cast(mage, "blink", mage.profile.id, requestId);
      await delay(150);
      assert.equal(mage.self!.cooldowns!.blink, untilCooldown);
      assert.equal(
        mage.events.filter(
          (e) => e.type === "mobility" && e.ability === "blink",
        ).length,
        1,
      );
      await rejected(
        mage,
        { kind: "attack", slot: 0, target: mage.profile.id },
        /cooling/,
      );
    },
  );
  await check("Cooldowns follow the skill through slot changes", async () => {
    const config = mage.profile.combat!;
    mage.send({
      kind: "combatLoadout",
      ...config,
      slots: [
        "firebolt",
        "blink",
        "meteor",
        "arcane-barrage",
        "frostbolt",
        "counterspell",
      ],
    });
    await until(() => mage.profile.combat?.slots[1] === "blink");
    await rejected(
      mage,
      { kind: "attack", slot: 1, target: mage.profile.id },
      /cooling/,
    );
  });
  await check(
    "Vanish hides hero and pet from existing and newly joined clients, then expires",
    async () => {
      cast(rogue, "vanish");
      await until(() => (rogue.self?.stealthUntil ?? 0) > Date.now());
      assert(rogue.self, "The owner retains their character");
      await until(
        () => !fresh.world!.players.some((p) => p.id === rogue.profile.id),
      );
      const newcomer = await hero("New Observer", "mage", room, 1);
      assert(!newcomer.world!.players.some((p) => p.id === rogue.profile.id));
      await until(
        () => fresh.world!.players.some((p) => p.id === rogue.profile.id),
        10000,
      );
    },
  );
  await check(
    "Both heavy classes charge into melee and hit training targets",
    async () => {
      for (const p of [knight, warrior]) {
        await travel(p, 27, -25);
        const id = p === knight ? "shield-charge" : "charge",
          mark = p.events.length;
        cast(p, id, "training-strikes");
        await until(() =>
          p.events
            .slice(mark)
            .some((e) => e.type === "mobility" && e.ability === id),
        );
        await until(() =>
          p.events
            .slice(mark)
            .some((e) => e.type === "impact" && e.ability === id),
        );
        assert(Math.hypot(p.self!.x - 35, p.self!.z + 25) <= 4.5);
        await until(() => (p.self?.resource ?? 0) >= (p === knight ? 15 : 20));
        await rejected(p, { kind: "combatReset" }, /combat|encounter/i);
        p.send({ kind: "autoattack", target: null });
      }
    },
  );
  await check(
    "Shadowstep closes the gap and awards a combo point",
    async () => {
      await travel(rogue, 27, -25);
      await ready(rogue);
      cast(rogue, "shadowstep", "training-strikes");
      await until(() =>
        rogue.events.some(
          (e) => e.type === "impact" && e.ability === "shadowstep",
        ),
      );
      await until(
        () => Math.hypot(rogue.self!.x - 35, rogue.self!.z + 25) <= 4.5,
      );
      await until(() => (rogue.self?.combo ?? 0) >= 1);
    },
  );
  await check(
    "Attacking breaks Vanish and reveals the hero to peers",
    async () => {
      await until(
        () => (rogue.self?.cooldowns?.vanish ?? 0) <= Date.now(),
        32000,
      );
      await ready(rogue);
      cast(rogue, "vanish");
      await until(() => (rogue.self?.stealthUntil ?? 0) > Date.now());
      await ready(rogue);
      cast(rogue, "stab", "training-strikes");
      await until(() => (rogue.self?.stealthUntil ?? 0) <= Date.now());
      await until(() =>
        fresh.world!.players.some((p) => p.id === rogue.profile.id),
      );
    },
  );
  await check(
    "Duel opponents cannot target a vanished Rogue or gain locked skills from normalization",
    async () => {
      const hidden = await hero("Dueling Rogue", "rogue", room, 2);
      fresh.send({ kind: "duel", target: hidden.profile.id });
      await until(() => !!hidden.self?.duelId);
      hidden.send({ kind: "duelAccept", id: hidden.self!.duelId! });
      await until(() =>
        hidden.world!.duels.some(
          (d) => d.id === hidden.self?.duelId && d.state === "active",
        ),
      );
      assert.equal(hidden.self!.skillLevel, 2);
      assert.equal(slots(hidden).filter(Boolean).length, 2);
      cast(hidden, "vanish");
      await until(
        () => !fresh.world!.players.some((p) => p.id === hidden.profile.id),
      );
      await rejected(
        fresh,
        { kind: "attack", slot: 0, target: hidden.profile.id },
        /hidden/,
      );
      assert(hidden.self?.duelId);
      await rejected(
        hidden,
        {
          kind: "combatLoadout",
          slots: ["ambush", null, null, null, null, null],
          layout: "row",
          labels: true,
        },
        /duel|encounter/i,
      );
    },
  );
  await check("Reset restores automatic unlocked skills", async () => {
    mage.send({ kind: "combatReset" });
    await until(() => !mage.profile.combat);
    assert.equal(slots(mage)[0], "firebolt");
    assert.equal(slots(mage)[1], "blink");
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  await writeFile(
    "evidence/class-combat-network.json",
    JSON.stringify({ checks, errors: players.map((p) => p.errors) }, null, 2),
  );
  await writeFile("evidence/class-combat-network-server.log", serverLog);
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
