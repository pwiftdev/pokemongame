import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, until, delay } from "./network-client.js";
const players: NetworkPlayer[] = [];
const checks: string[] = [];
try {
  const a = await NetworkPlayer.create(
    `Practice${Date.now().toString(36)}`,
    undefined,
    "new",
  );
  players.push(a);
  await a.starter();
  const b = await NetworkPlayer.create(
    `Rival${Date.now().toString(36)}`,
    undefined,
    a.room.roomId,
  );
  players.push(b);
  await b.starter();
  await until(() => a.world!.players.length === 2);
  const origin = { x: a.self!.x, z: a.self!.z };
  a.send({ kind: "duel", target: b.profile.id });
  await until(() => a.world!.duels.some((d) => d.state === "invite"));
  const invitation = a.world!.duels.find((d) => d.state === "invite")!;
  b.send({ kind: "duelAccept", id: invitation.id });
  await until(() =>
    a.world!.duels.some((d) => d.id === invitation.id && d.state === "active"),
  );
  assert(Math.hypot(a.self!.x - origin.x, a.self!.z - origin.z) < 0.3);
  assert.equal(a.self!.level, 10);
  assert.equal(a.self!.hp, 180);
  await a.go(0, -25);
  assert(a.self!.z > -27);
  await b.go(3, -25);
  a.send({ kind: "attack", target: b.profile.id, slot: 0 });
  await until(
    () => b.self!.hp < 180,
    8000,
    () => JSON.stringify(a.errors),
  );
  b.send({ kind: "surrender" });
  await until(() => !a.self!.duelId && !b.self!.duelId);
  assert(a.self!.hp > 0);
  assert.equal(a.self!.level, 1);
  checks.push(
    "Consented world duel stays at its location, movement works outside arena, normalized combat damages only duel health and surrender restores adventure mode",
  );
  await a.go(23, -25);
  await a.go(33, -27);
  const dummy = () => a.world!.wilds.find((w) => w.id === "training-strikes")!;
  const before = {
    balance: a.profile.balance,
    xp: a.profile.creatures[0].xp,
    hp: a.self!.hp,
  };
  a.send({ kind: "pet", mode: "passive" });
  a.send({ kind: "attack", target: dummy().id, slot: 0 });
  await until(
    () => !!a.self?.practice?.hits,
    8000,
    () => JSON.stringify(a.errors),
  );
  assert(a.self!.practice!.damage > 0);
  assert(dummy().hp < dummy().maxHp);
  assert.equal(a.self!.hp, before.hp);
  a.send({ kind: "practiceReset" });
  await until(() => !a.self!.practice);
  await delay(1200);
  assert(!a.self!.practice);
  a.send({ kind: "petMove", target: dummy().id, slot: 0 });
  await until(
    () => !!a.self!.practice?.hits,
    10000,
    () => JSON.stringify(a.errors),
  );
  a.send({ kind: "practiceReset" });
  await until(() => !a.self!.practice);
  await delay(10500);
  assert.equal(dummy().hp, dummy().maxHp);
  assert.equal(a.profile.balance, before.balance);
  assert.equal(a.profile.creatures[0].xp, before.xp);
  checks.push(
    "Hero and companion attacks work in the sanctuary practice yard; personal meter resets, target recovers, and no XP/currency is farmed",
  );
  a.send({ kind: "tame", target: dummy().id, item: "capsule" });
  await until(() => a.errors.some((e) => e.includes("cannot be captured")));
  a.errors.length = 0;
  await a.go(24, -16);
  await b.go(18, -16);
  a.send({ kind: "queue", join: true });
  b.send({ kind: "queue", join: true });
  await until(() =>
    a.world!.duels.some((d) => d.state === "active" && d.arena),
  );
  assert(Math.abs(a.self!.z + 13) < 0.3);
  assert(Math.abs(b.self!.z + 13) < 0.3);
  b.send({ kind: "surrender" });
  await until(() => !a.self!.duelId);
  checks.push(
    "Arena queue still arranges matches on starting marks; dummies reject captures",
  );
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await writeFile(
    "evidence/duels-training-network.json",
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(checks.join("\n"));
} finally {
  for (const p of players) await p.room.leave();
}
