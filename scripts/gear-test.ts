import { createWalletSession } from "./wallet-client.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, base, delay, until } from "./network-client.js";
import { travel } from "./server-navigation.js";
import { buyGear } from "../apps/server/src/gear.js";
import { mutate, pool } from "../apps/server/src/db.js";
import type { Command } from "../packages/shared/types.js";

if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Gear fixtures require a local test server.");
const players: NetworkPlayer[] = [],
  checks: string[] = [];
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function rejected(p: NetworkPlayer, command: Command, pattern: RegExp) {
  const mark = p.errors.length;
  p.send(command);
  await until(() => p.errors.length > mark);
  assert.match(p.errors[mark], pattern);
}
try {
  const p = await NetworkPlayer.create(
    "Gear network",
    (await createWalletSession(base, "Gear network")).token,
    "new",
  );
  players.push(p);
  await p.starter();
  const peer = await NetworkPlayer.create(
    "Gear observer",
    (await createWalletSession(base, "Gear observer")).token,
    p.room.roomId,
  );
  players.push(peer);
  await peer.starter();
  await travel(p, 8, -30);
  const initial = p.profile.balance;
  await check(
    "Purchases debit once, replay safely and reject ownership, class, level and price forgery",
    async () => {
      const requestId = randomUUID();
      p.send({ kind: "gearBuy", item: "mage-weapon-1", requestId });
      await until(() => !!p.profile.gear?.owned.includes("mage-weapon-1"));
      p.send({ kind: "gearBuy", item: "mage-weapon-1", requestId });
      await delay(200);
      assert.equal(p.profile.balance, initial - 80);
      assert.equal(p.profile.gear!.owned.length, 1);
      await rejected(
        p,
        { kind: "gearBuy", item: "mage-weapon-1" },
        /already own/,
      );
      await rejected(
        p,
        { kind: "gearBuy", item: "knight-weapon-1" },
        /Requires/,
      );
      await rejected(p, { kind: "gearBuy", item: "mage-weapon-5" }, /Requires/);
      await rejected(p, { kind: "gearBuy", item: "__proto__" }, /Unknown/);
      await rejected(
        p,
        { kind: "gearBuy", item: "chest-1", price: 0 } as Command,
        /Invalid/,
      );
    },
  );
  await check(
    "Owned items equip, replicate to peers, and unowned or wrong slots are rejected",
    async () => {
      await rejected(
        p,
        { kind: "gearEquip", item: "chest-1", slot: "chest" },
        /own/,
      );
      await rejected(
        p,
        { kind: "gearEquip", item: "mage-weapon-1", slot: "head" },
        /slot/,
      );
      p.send({ kind: "gearEquip", item: "mage-weapon-1", slot: "weapon" });
      await until(
        () =>
          peer.world?.players.find((a) => a.id === p.profile.id)?.equipment
            ?.weapon === "mage-weapon-1",
      );
      p.send({ kind: "gearBuy", item: "chest-1" });
      await until(() => !!p.profile.gear?.owned.includes("chest-1"));
      p.send({ kind: "gearEquip", item: "chest-1", slot: "chest" });
      await until(() => p.self?.maxHp === 176);
      assert(p.self!.hp < 176, "Equipping armor does not heal");
      await rejected(
        p,
        { kind: "gearBuy", item: "banner-traveler" },
        /Not enough/,
      );
      await rejected(
        p,
        { kind: "gearClaim", item: "sigil-warden" },
        /achievement/,
      );
      const room = p.room.roomId;
      await p.close();
      p.world = undefined;
      await p.join(room);
      assert.equal(p.profile.gear!.equipped.weapon, "mage-weapon-1");
      assert.equal(p.profile.gear!.equipped.chest, "chest-1");
    },
  );
  await check(
    "Gear cannot change during combat and duels keep equal health",
    async () => {
      await travel(peer, 8, -30);
      p.send({ kind: "duel", target: peer.profile.id });
      await until(() => !!peer.self?.duelId);
      peer.send({ kind: "duelAccept", id: peer.self!.duelId! });
      await until(() =>
        p.world!.duels.some(
          (d) => d.id === p.self?.duelId && d.state === "active",
        ),
      );
      assert.equal(p.self!.maxHp, 180);
      assert.equal(peer.self!.maxHp, 180);
      await rejected(
        p,
        { kind: "gearEquip", item: null, slot: "chest" },
        /encounter/,
      );
      await rejected(p, { kind: "gearBuy", item: "boots-1" }, /encounter/);
      p.send({ kind: "surrender" });
      await until(() => !p.self?.duelId);
      await travel(p, 0, -5);
      await rejected(p, { kind: "gearBuy", item: "boots-1" }, /Visit/);
    },
  );
  await check(
    "Equipped weapons increase real server damage on training targets",
    async () => {
      for (const player of [p, peer]) {
        player.send({ kind: "pet", mode: "passive" });
        await travel(player, 33, -25);
        player.send({ kind: "autoattack", target: "training-strikes" });
      }
      const hit = (player: NetworkPlayer) =>
        player.events.find(
          (e) =>
            e.type === "swing" &&
            e.source === player.profile.id &&
            e.target === "training-strikes" &&
            e.outcome === "hit",
        );
      await until(() => !!hit(p) && !!hit(peer), 20000);
      assert(hit(p)!.amount! >= 10 && hit(p)!.amount! <= 13);
      assert(hit(peer)!.amount! >= 6 && hit(peer)!.amount! <= 9);
      for (const player of [p, peer])
        player.send({ kind: "autoattack", target: null });
      await rejected(
        p,
        { kind: "gearEquip", slot: "weapon", item: null },
        /encounter/,
      );
    },
  );
  await check(
    "Concurrent purchases and failures keep currency and ownership atomic",
    async () => {
      await p.close();
      await mutate(p.profile.id, randomUUID(), (profile) => {
        profile.balance = 1000;
      });
      const results = await Promise.allSettled(
        [1, 2].map(() => {
          const id = randomUUID();
          return mutate(p.profile.id, id, (profile, tx) =>
            buyGear(profile, tx, "boots-1", id),
          );
        }),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const failed = randomUUID();
      await assert.rejects(
        mutate(p.profile.id, failed, async (profile, tx) => {
          await buyGear(profile, tx, "head-1", failed);
          throw new Error("After debit failure");
        }),
        /After debit/,
      );
      const saved = (await mutate(p.profile.id, randomUUID(), () => {}))
        .profile;
      assert.equal(saved.balance, 956);
      assert.equal(
        saved.gear!.owned.filter((id) => id === "boots-1").length,
        1,
      );
      assert(!saved.gear!.owned.includes("head-1"));
      const ledger = await pool.query(
        "SELECT amount FROM ledger WHERE player_id=$1 AND reference=$2",
        [p.profile.id, failed],
      );
      assert.equal(ledger.rowCount, 0);
    },
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  await writeFile(
    "evidence/gear-network.json",
    JSON.stringify({ checks }, null, 2),
  );
  await pool.end();
}
