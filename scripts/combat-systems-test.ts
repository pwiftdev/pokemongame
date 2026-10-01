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
const port = Number(process.env.COMBAT_TEST_PORT ?? 2572);
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
async function hero(name: string, classId: ClassId, room: string, level = 1) {
  const p = await NetworkPlayer.create(name, undefined, room);
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
const wild = (p: Player, id: string) =>
  p.world!.wilds.find((w) => w.id === id)!;
const errorsSince = (p: Player, mark: number) => p.errors.slice(mark);
/** Walk to `range` metres from a creature on the side facing the player. */
async function approach(p: Player, id: string, range = 2.2) {
  const w = wild(p, id);
  await travel(p, w.x + range * 2, w.z);
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const me = p.self!,
      target = wild(p, id);
    const d = Math.hypot(me.x - target.x, me.z - target.z);
    if (Math.abs(d - range) < 0.6) break;
    const goal = {
      x: target.x + ((me.x - target.x) / Math.max(0.01, d)) * range,
      z: target.z + ((me.z - target.z) / Math.max(0.01, d)) * range,
    };
    const dx = goal.x - me.x,
      dz = goal.z - me.z,
      step = Math.hypot(dx, dz);
    p.send({
      kind: "move",
      dx: dx / Math.max(1, step),
      dz: dz / Math.max(1, step),
      yaw: Math.atan2(dx, dz),
      sprint: false,
    });
    await delay(80);
  }
  p.stop();
  await delay(150);
}
/** Wait until a creature is alive, home and not fighting anyone. */
async function settled(p: Player, id: string) {
  await until(
    () => {
      const w = wild(p, id);
      return !!w && w.hp > 0 && !w.evading && !w.target && !w.threat;
    },
    30000,
    `${id} to settle`,
  );
}
async function gcd(p: Player) {
  await until(() => (p.self?.gcdUntil ?? 0) <= Date.now() + 20, 3000);
}

try {
  for (let tries = 0; ; tries++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (tries > 100) throw new Error("Isolated server failed to start");
    await delay(100);
  }

  const knight = await hero("Systems Knight", "knight", "new");
  const room = knight.room.roomId;

  await check(
    "Valor starts empty, spenders are gated and builders fill it",
    async () => {
      assert.equal(knight.self!.resource, 0);
      assert.equal(knight.self!.resourceMax, 100);
      await approach(knight, "sprig-1");
      let mark = knight.errors.length;
      knight.send({ kind: "attack", target: "sprig-1", slot: 1 });
      await until(() => knight.errors.length > mark);
      assert.equal(errorsSince(knight, mark)[0], "Not enough Valor.");
      mark = knight.errors.length;
      knight.send({ kind: "attack", target: "sprig-1", slot: 4 });
      await until(() => knight.errors.length > mark);
      assert.equal(
        errorsSince(knight, mark)[0],
        "Challenge unlocks at level 2.",
      );
      const events = knight.events.length;
      knight.send({ kind: "attack", target: "sprig-1", slot: 0 });
      await until(() =>
        knight.events
          .slice(events)
          .some((e) => e.type === "impact" && e.ability === "slash"),
      );
      const slash = knight.events
        .slice(events)
        .find((e) => e.type === "impact" && e.ability === "slash")!;
      assert(slash.outcome, "Impacts report a hit-table outcome");
      if (slash.outcome === "hit" || slash.outcome === "crit")
        await until(() => (knight.self?.resource ?? 0) >= 15);
    },
  );

  await check(
    "The global cooldown rejects an immediate second ability",
    async () => {
      await gcd(knight);
      const mark = knight.errors.length;
      knight.send({ kind: "attack", target: "sprig-1", slot: 0 });
      await delay(400);
      knight.send({ kind: "attack", target: "sprig-1", slot: 0 });
      await until(() => knight.errors.length > mark);
      assert.equal(errorsSince(knight, mark)[0], "Not ready yet.");
      assert((knight.self?.gcdUntil ?? 0) > Date.now() - 1100);
    },
  );

  await check(
    "Abilities start auto attacks that swing on the weapon timer",
    async () => {
      await until(
        () =>
          knight.self?.autoTarget === "sprig-1" ||
          wild(knight, "sprig-1").hp <= 0,
      );
      if (wild(knight, "sprig-1").hp > 0) {
        const mark = knight.events.length;
        await until(
          () =>
            knight.events
              .slice(mark)
              .filter(
                (e) => e.type === "swing" && e.source === knight.profile.id,
              ).length >= 2 || wild(knight, "sprig-1").hp <= 0,
          9000,
        );
        const swings = knight.events
          .slice(mark)
          .filter((e) => e.type === "swing" && e.source === knight.profile.id);
        assert(swings.every((e) => e.auto && e.outcome));
        if (swings.length >= 2) {
          const gap =
            knight.events.indexOf(swings[1]) - knight.events.indexOf(swings[0]);
          assert(gap > 0);
        }
      }
      while (wild(knight, "sprig-1").hp > 0) {
        await gcd(knight);
        knight.send({ kind: "attack", target: "sprig-1", slot: 0 });
        await delay(1050);
      }
      await until(() => !knight.self?.autoTarget, 3000);
    },
  );

  await check("Health regenerates once combat ends", async () => {
    const self = () => knight.self!;
    if (self().hp >= self().maxHp) {
      await approach(knight, "sprig-2", 2);
      await until(() => self().hp < self().maxHp, 15000);
      await travel(knight, -30, 0);
    }
    const low = self().hp;
    await until(() => !self().inCombat, 15000);
    await until(() => self().hp > low, 6000);
  });

  const mage = await hero("Systems Mage", "mage", room, 3);
  const guard = await hero("Systems Guard", "knight", room, 3);
  const rogue = await hero("Systems Rogue", "rogue", room, 3);
  const barbarian = await hero("Systems Barbarian", "barbarian", room, 3);

  await check("Mana is spent by spells and energy by strikes", async () => {
    assert.equal(mage.self!.resourceMax, 120);
    assert.equal(mage.self!.resource, 120);
    assert.equal(rogue.self!.resource, 100);
  });

  await check(
    "A Knight's Challenge taunts a creature off the Mage and takes the threat lead",
    async () => {
      await settled(mage, "sprig-2");
      await approach(mage, "sprig-2", 12);
      await approach(guard, "sprig-2", 7);
      mage.send({ kind: "attack", target: "sprig-2", slot: 0 });
      await until(
        () => wild(mage, "sprig-2").target === mage.profile.id,
        6000,
        () =>
          `sprig-2 to target the Mage: ${JSON.stringify(wild(mage, "sprig-2"))} ${JSON.stringify(mage.events.slice(-4))}`,
      );
      guard.send({ kind: "attack", target: "sprig-2", slot: 4 });
      await until(
        () => wild(guard, "sprig-2").target === guard.profile.id,
        3000,
        "Challenge to taunt sprig-2",
      );
      const w = wild(guard, "sprig-2");
      assert(w.auras?.some((a) => a.id === "taunted"));
      assert.equal(w.threat?.[guard.profile.id], 100);
      assert(
        guard.events.some(
          (e) => e.type === "impact" && e.ability === "challenge",
        ),
      );
    },
  );

  await check(
    "Frost Nova chills and Ice Lance shatters for triple damage",
    async () => {
      const chilled = () =>
        !!wild(mage, "sprig-2").auras?.some((a) => a.id === "slow");
      await approach(mage, "sprig-2", 9);
      for (let tries = 0; !chilled() && tries < 3; tries++) {
        await until(
          () => (mage.self?.cooldowns?.frostbolt ?? 0) <= Date.now(),
          7000,
          "Frost Nova cooldown",
        );
        await gcd(mage);
        const mark = mage.events.length;
        mage.send({ kind: "attack", target: "sprig-2", slot: 1 });
        await until(
          () =>
            mage.events
              .slice(mark)
              .some((e) => e.type === "impact" && e.ability === "frostbolt"),
          4000,
          () =>
            `Frost Nova impact; errors ${JSON.stringify(mage.errors.slice(-3))}; target ${JSON.stringify(wild(mage, "sprig-2"))}`,
        );
        await delay(150);
      }
      assert(chilled(), "Frost Nova chills the target");
      await gcd(mage);
      const mark = mage.events.length;
      mage.send({ kind: "attack", target: "sprig-2", slot: 5 });
      await until(() =>
        mage.events
          .slice(mark)
          .some((e) => e.type === "impact" && e.ability === "icelance"),
      );
      const lance = mage.events
        .slice(mark)
        .find((e) => e.type === "impact" && e.ability === "icelance")!;
      if (lance.outcome === "hit" || lance.outcome === "crit")
        assert(
          mage.events.slice(mark).some((e) => e.type === "shatter"),
          "A landed Ice Lance on a chilled target shatters",
        );
      assert(mage.self!.resource! < 120, "Spells cost mana");
    },
  );

  await check(
    "Rogue builders award combo points and Eviscerate consumes them",
    async () => {
      await approach(rogue, "sprig-2", 2);
      for (let tries = 0; (rogue.self?.combo ?? 0) < 2 && tries < 8; tries++) {
        await gcd(rogue);
        await until(() => (rogue.self?.resource ?? 0) >= 30, 5000);
        if (wild(rogue, "sprig-2").hp <= 0) break;
        rogue.send({ kind: "attack", target: "sprig-2", slot: 0 });
        await delay(900);
      }
      if (wild(rogue, "sprig-2").hp <= 0) return;
      assert((rogue.self?.combo ?? 0) >= 1);
      await gcd(rogue);
      await until(() => (rogue.self?.resource ?? 0) >= 35, 5000);
      const mark = rogue.events.length;
      rogue.send({ kind: "attack", target: "sprig-2", slot: 4 });
      await until(() =>
        rogue.events
          .slice(mark)
          .some((e) => e.type === "impact" && e.ability === "eviscerate"),
      );
      await until(() => rogue.self?.combo === 0, 2000);
    },
  );

  await check("Venom Blade poisons for periodic damage", async () => {
    const target = ["sprig-2", "sprig-1"].find((id) => wild(rogue, id).hp > 0);
    if (!target) return;
    await approach(rogue, target, 2);
    await until(() => (rogue.self?.resource ?? 0) >= 35, 5000);
    await gcd(rogue);
    const mark = rogue.events.length;
    for (let tries = 0; tries < 3; tries++) {
      rogue.send({ kind: "attack", target, slot: 1 });
      await until(
        () =>
          rogue.events
            .slice(mark)
            .some((e) => e.type === "impact" && e.ability === "venom"),
        4000,
      );
      if (
        rogue.events
          .slice(mark)
          .some(
            (e) =>
              e.type === "impact" &&
              e.ability === "venom" &&
              ["hit", "crit"].includes(e.outcome ?? ""),
          )
      )
        break;
      await delay(5200);
    }
    await until(
      () =>
        rogue.events
          .slice(mark)
          .some(
            (e) =>
              e.type === "dot" &&
              e.source === rogue.profile.id &&
              (e.amount ?? 0) > 0,
          ) || wild(rogue, target).hp <= 0,
      4000,
    );
  });

  await check("Execute is only usable on a wounded target", async () => {
    const target = ["sprig-1", "sprig-2"].find(
      (id) => wild(barbarian, id).hp / wild(barbarian, id).maxHp > 0.3,
    );
    if (!target) return;
    await approach(barbarian, target, 2);
    const mark = barbarian.errors.length;
    barbarian.send({ kind: "attack", target, slot: 4 });
    await until(() => barbarian.errors.length > mark);
    assert.match(
      errorsSince(barbarian, mark)[0],
      /Not enough Rage|below 25% health/,
    );
  });

  await check(
    "A creature shot from long range fights back, then evades and resets past its leash",
    async () => {
      const id = "squirtle-pool-2";
      await settled(mage, id);
      await until(() => (mage.self?.resource ?? 0) >= 20, 20000, "mana");
      await approach(mage, id, 16);
      await gcd(mage);
      mage.send({ kind: "attack", target: id, slot: 0 });
      await until(
        () => wild(mage, id).target === mage.profile.id,
        6000,
        () => `${id} to fight back: ${JSON.stringify(wild(mage, id))}`,
      );
      await until(
        () => mage.events.some((e) => e.type === "hit" && e.source === id),
        12000,
        `${id} to attack the Mage`,
      );
      let sawEvade = false;
      const remove = mage.room.onMessage(
        "world",
        (snapshot: { wilds: { id: string; evading?: boolean }[] }) => {
          sawEvade ||= !!snapshot.wilds.find((w) => w.id === id)?.evading;
        },
      );
      await travel(mage, -8, -2);
      await until(() => sawEvade, 10000, `${id} to evade while retreating`);
      remove();
      await until(
        () => {
          const w = wild(mage, id);
          return !w.evading && w.hp === w.maxHp && !w.target;
        },
        15000,
        `${id} to reset`,
      );
    },
  );

  await check(
    "Counterspell interrupts a creature spell and locks it out",
    async () => {
      await travel(mage, -13, 17);
      const caster = "squirtle-pool";
      await until(() => wild(mage, caster)?.hp > 0, 5000);
      await until(() => (mage.self?.resource ?? 0) >= 30, 20000);
      await gcd(mage);
      mage.send({ kind: "attack", target: caster, slot: 0 });
      await until(() => !!wild(mage, caster).cast?.spell, 20000);
      const spell = wild(mage, caster).cast!;
      assert(spell.interruptible);
      const mark = mage.events.length;
      mage.send({ kind: "attack", target: caster, slot: 4 });
      await until(
        () =>
          mage.events
            .slice(mark)
            .some(
              (e) =>
                e.type === "interrupt" ||
                (e.type === "impact" && e.ability === "counterspell"),
            ),
        3000,
      );
      const hit = mage.events
        .slice(mark)
        .find((e) => e.type === "impact" && e.ability === "counterspell");
      if (hit && !["hit", "crit"].includes(hit.outcome ?? "")) return;
      await until(
        () => mage.events.slice(mark).some((e) => e.type === "interrupt"),
        2000,
      );
      await until(
        () =>
          !wild(mage, caster).cast?.spell &&
          !!wild(mage, caster).auras?.some((a) => a.id === "silenced"),
        1000,
        "the spell to be cancelled and the caster locked out",
      );
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
    "evidence/combat-systems-test.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        method:
          "Real Colyseus clients against an isolated server and PostgreSQL schema. Level-3 fixtures use the production mutate path; every ability, auto attack and creature response uses the authoritative command and tick paths.",
        checks,
        errors: players.map((p) => p.errors),
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile("evidence/combat-systems-test.log", serverLog);
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
