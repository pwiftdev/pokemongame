import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, delay, until, base } from "./network-client.js";
const players: NetworkPlayer[] = [];
const checks: { name: string; passed: boolean; detail?: string }[] = [];
const check = async (name: string, run: () => Promise<void>) => {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    checks.push({ name, passed: false, detail: String(e) });
    console.error(`FAIL ${name}: ${e}`);
  }
};
try {
  const a = await NetworkPlayer.create(`NetA${Date.now().toString(36)}`),
    b = await NetworkPlayer.create(`NetB${Date.now().toString(36)}`);
  players.push(a, b);
  await check(
    "Two independent identities share one authoritative world",
    async () => {
      assert.notEqual(a.profile.id, b.profile.id);
      assert.equal(a.room.roomId, b.room.roomId);
      await until(
        () =>
          a.world!.players.some((p) => p.id === b.profile.id) &&
          b.world!.players.some((p) => p.id === a.profile.id),
      );
    },
  );
  await check(
    "Starter creation and quest reward persist; duplicate request gives one grant",
    async () => {
      await a.starter();
      await b.starter("cindercub");
      const balance = a.profile.balance;
      const requestId = randomUUID();
      for (let i = 0; i < 5; i++)
        a.send({ kind: "claim", quest: "first-friend", requestId });
      await until(() => a.profile.claimed.includes("first-friend"));
      await delay(300);
      assert.equal(a.profile.balance, balance + 40);
    },
  );
  await check(
    "Malformed teleport/currency/ownership commands are rejected",
    async () => {
      const initial = a.self!;
      const errorCount = a.errors.length;
      a.send({ kind: "move", dx: 9999, dz: 9999, yaw: 0, sprint: true });
      a.send({ kind: "setBalance", balance: 999999 });
      a.send({ kind: "deploy", id: b.profile.active });
      await until(() => a.errors.length >= errorCount + 3);
      assert(Math.hypot(a.self!.x - initial.x, a.self!.z - initial.z) < 1);
      assert(a.profile.balance < 999999);
      assert.notEqual(a.profile.active, b.profile.active);
    },
  );
  await check("Authoritative movement and shared discovery", async () => {
    await a.go(0, -17);
    await a.go(-10, -5);
    await until(() => a.profile.discoveries.includes("meadow"));
    await until(() =>
      b.world!.players.some((p) => p.id === a.profile.id && p.z > -10),
    );
  });
  await check(
    "Wild combat applies damage and rejects cooldown bypass",
    async () => {
      const wild = a.world!.wilds.find((w) => w.id === "sprig-1")!;
      await a.go(wild.x - 4, wild.z - 1);
      const hp = wild.hp;
      const errors = a.errors.length;
      a.send({ kind: "attack", target: wild.id, slot: 0 });
      a.send({ kind: "attack", target: wild.id, slot: 0 });
      await until(() => a.world!.wilds.find((w) => w.id === wild.id)!.hp < hp);
      await until(() => a.errors.length > errors);
    },
  );
  await check("Wild defeat grants verified progression", async () => {
    const id = "sprig-1";
    for (
      let i = 0;
      i < 20 && a.world!.wilds.find((w) => w.id === id)!.hp > 0;
      i++
    ) {
      a.send({ kind: "attack", target: id, slot: 0 });
      await delay(1350);
    }
    await until(() => (a.profile.quests.defeats ?? 0) > 0);
    assert(a.profile.creatures[0].xp > 0 || a.profile.creatures[0].level > 1);
  });
  await check("Shop purchase is atomic and retry-safe", async () => {
    await a.go(0, -17);
    await a.go(10, -28);
    const count = a.profile.inventory.capsule ?? 0,
      balance = a.profile.balance,
      requestId = randomUUID();
    for (let i = 0; i < 4; i++)
      a.send({ kind: "buy", item: "capsule", quantity: 1, requestId });
    await until(() => (a.profile.inventory.capsule ?? 0) > count);
    await delay(300);
    assert.equal(a.profile.inventory.capsule, count + 1);
    assert.equal(a.profile.balance, balance - 15);
  });
  await check(
    "Consensual duel starts for both players with normalized health",
    async () => {
      await a.go(23, -13);
      await b.go(23, -13);
      a.send({ kind: "duel", target: b.profile.id });
      await until(
        () =>
          !!b.world!.duels.find(
            (d) => d.a === a.profile.id && d.state === "invite",
          ),
      );
      const invite = b.world!.duels.find(
        (d) => d.a === a.profile.id && d.state === "invite",
      )!;
      b.send({ kind: "duelAccept", id: invite.id });
      await until(
        () =>
          a.world!.duels.some(
            (d) => d.id === invite.id && d.state === "active",
          ) &&
          b.world!.duels.some(
            (d) => d.id === invite.id && d.state === "active",
          ),
      );
      assert.equal(a.self!.maxHp, b.self!.maxHp);
    },
  );
  await check(
    "Real player command combat records one duel outcome for both clients",
    async () => {
      const duel = a.world!.duels.find(
        (d) => d.state === "active" && d.a === a.profile.id,
      )!;
      assert(duel);
      for (let i = 0; i < 35; i++) {
        const current = a.world!.duels.find((d) => d.id === duel.id);
        if (!current || current.state === "finished") break;
        a.send({ kind: "attack", target: b.profile.id, slot: 0 });
        await delay(1350);
      }
      await until(() => a.profile.wins === 1 && b.profile.losses === 1);
      assert.equal(
        a.world!.duels.find((d) => d.id === duel.id)?.winner,
        a.profile.id,
      );
      const matches = await fetch(`${base}/api/matches`, {
        headers: { Authorization: `Bearer ${a.token}` },
      }).then((r) => r.json());
      assert.equal(
        matches.filter((m: { id: string }) => m.id === duel.id).length,
        1,
      );
    },
  );
  await check(
    "Session reconnect retains collection, quests, inventory, and PD",
    async () => {
      const before = structuredClone(a.profile);
      await a.close();
      await delay(300);
      const resumed = await NetworkPlayer.create(before.nickname, a.token);
      players.push(resumed);
      assert.deepEqual(resumed.profile, before);
      assert.equal(resumed.self!.id, before.id);
    },
  );
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  await writeFile(
    process.env.NETWORK_EVIDENCE ?? "evidence/network-test.json",
    JSON.stringify(
      { timestamp: new Date().toISOString(), server: base, checks },
      null,
      2,
    ),
  );
  if (checks.some((c) => !c.passed)) process.exitCode = 1;
}
