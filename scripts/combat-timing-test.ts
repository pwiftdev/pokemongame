import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { CLASS_IDS } from "../packages/shared/classes.js";
import { shapeContains } from "../packages/shared/combat.js";
import { distance } from "../packages/shared/rules.js";
import { NetworkPlayer, delay, until } from "./network-client.js";
import { travel } from "./server-navigation.js";
const results: string[] = [];
for (const classId of CLASS_IDS) {
  const p = await NetworkPlayer.create(`Dash ${classId}`, undefined, "new");
  try {
    p.send({ kind: "starter", classId, species: "bulbasaur" });
    await until(() => p.profile.creatures.length > 0);
    const before = { ...p.self! };
    p.send({ kind: "dash", dx: 1, dz: 0 });
    await until(() => !!p.self?.cooldowns?.dash);
    await delay(450);
    assert(distance(before, p.self!) > 3, `${classId} dash must move`);
    assert(distance(before, p.self!) < 6, "Dash distance must be bounded");
    const after = { ...p.self! };
    p.send({ kind: "dash", dx: 1, dz: 0 });
    await until(() => p.errors.length > 0);
    assert.equal(p.errors.pop(), "Dash is not ready.");
    await delay(150);
    assert(
      distance(after, p.self!) < 0.1,
      "Cooldown must prevent repeated dash",
    );
    results.push(`${classId}: dash and cooldown`);
    if (classId === "knight") {
      p.send({ kind: "pet", mode: "passive" });
      await travel(p, -39, 6);
      const enemy = () => p.world!.wilds.find((w) => w.id === "sprig-1")!;
      await p.go(enemy().x + 1.5, enemy().z, 5000);
      await until(() => !!enemy().cast);
      const threat = { ...enemy().cast! };
      await delay(Math.max(0, threat.resolvesAt - Date.now() - 130));
      const dashMark = p.events.length;
      const dx = enemy().x - p.self!.x,
        dz = enemy().z - p.self!.z,
        magnitude = Math.hypot(dx, dz);
      p.send({ kind: "dash", dx: dx / magnitude, dz: dz / magnitude });
      await delay(Math.max(0, threat.resolvesAt - Date.now()) + 80);
      assert(
        shapeContains(threat, p.self!),
        "Dash test must stay inside the attack shape",
      );
      assert(
        !p.events
          .slice(dashMark)
          .some((e) => e.type === "hit" && !e.auto && (e.amount ?? 0) > 0),
        "Dash invulnerability must avoid a strike even inside its shape",
      );
      results.push(
        "Dash invulnerability prevents an otherwise intersecting claw hit",
      );
      await until(() => !p.self?.dash);
      // Unavoided swings only: blocks, parries, dodges and misses change the amount.
      const plain = (e: (typeof p.events)[number]) =>
        e.type === "hit" && e.auto && e.outcome === "hit";
      let guarded: number | undefined;
      for (let attempt = 0; guarded === undefined && attempt < 4; attempt++) {
        await until(
          () => (p.self?.cooldowns?.bulwark ?? 0) <= Date.now(),
          13000,
          "Bulwark cooldown",
        );
        const mark = p.events.length;
        p.send({ kind: "attack", target: p.profile.id, slot: 3 });
        await until(() => (p.self?.guardUntil ?? 0) > Date.now());
        const until_ = p.self!.guardUntil!;
        await delay(Math.max(0, until_ - Date.now() - 100));
        guarded = p.events.slice(mark).find(plain)?.amount;
      }
      assert(guarded !== undefined, "A swing must land during Bulwark");
      await until(() => (p.self?.guardUntil ?? 0) <= Date.now(), 6000);
      const mark2 = p.events.length;
      await until(
        () => p.events.slice(mark2).some(plain),
        20000,
        "an unguarded swing",
      );
      const full = p.events.slice(mark2).find(plain)!.amount!;
      assert(guarded < full, "Guard must reduce damage");
      results.push(`Guard reduces melee damage: ${guarded} vs ${full}`);
      await until(() => (p.self?.resource ?? 0) >= 15, 20000);
      await p.go(enemy().x + 1.2, enemy().z, 5000);
      await until(
        () =>
          !!enemy().cast &&
          enemy().cast!.resolvesAt - Date.now() > 430 &&
          distance(p.self!, enemy()) < 4,
        10000,
      );
      const interrupted = enemy().cast!.resolvesAt;
      const special = (e: (typeof p.events)[number]) =>
        e.type === "hit" && !e.auto;
      const hits = p.events.filter(special).length;
      p.send({ kind: "attack", target: enemy().id, slot: 1 });
      await until(() =>
        p.events.some(
          (e) => e.type === "impact" && e.ability === "shield-strike",
        ),
      );
      await delay(Math.max(0, interrupted - Date.now()) + 100);
      assert.equal(
        p.events.filter(special).length,
        hits,
        "Shield Strike must interrupt the pending enemy hit",
      );
      results.push("Shield Strike interrupts an enemy windup before damage");
      assert.deepEqual(p.errors, []);
    }
    if (classId !== "mage") continue;
    p.send({ kind: "pet", mode: "passive" });
    await travel(p, -31, 4);
    await delay(350);
    const wild = () => p.world!.wilds.find((w) => w.id === "sprig-1")!;
    const hp = wild().hp;
    p.send({ kind: "attack", target: wild().id, slot: 2 });
    await until(() => !!p.self?.cast);
    assert.equal(wild().hp, hp, "Windup must not apply damage");
    p.send({ kind: "move", dx: 0, dz: -1, yaw: Math.PI, sprint: false });
    await until(() => p.events.some((e) => e.type === "cast-cancel"));
    p.stop();
    await delay(1800);
    assert.equal(wild().hp, hp, "Cancelled meteor must not land later");
    results.push("Meteor: movement cancellation, no phantom damage");
    p.send({ kind: "attack", target: wild().id, slot: 0 });
    await until(() => p.self?.cast?.ability === "firebolt");
    const started = p.self!.cast!.startedAt;
    assert.equal(wild().hp, hp);
    await until(() =>
      p.events.some((e) => e.type === "attack" && e.ability === "firebolt"),
    );
    assert(Date.now() - started >= 500, "Firebolt must cast before release");
    assert.equal(wild().hp, hp, "Projectile must travel before damage");
    await until(() =>
      p.events.some((e) => e.type === "impact" && e.ability === "firebolt"),
    );
    const landing = p.events.find(
      (e) => e.type === "impact" && e.ability === "firebolt",
    )!;
    assert(
      wild().hp < hp || landing.amount! > 0 || landing.outcome === "miss",
      "The authoritative impact must resolve as damage or a miss",
    );
    results.push("Firebolt: cast, release, travel, authoritative impact");
    await until(() => !p.self?.cast);
    await until(() => (p.self?.gcdUntil ?? 0) <= Date.now());
    p.send({ kind: "attack", target: wild().id, slot: 2 });
    await until(() => p.self?.cast?.ability === "meteor");
    p.send({ kind: "dash", dx: 0, dz: -1 });
    await until(() => !p.self?.cast && !!p.self?.dash);
    results.push("Dash cancels an unfinished cast");
    assert.deepEqual(p.errors, []);
  } finally {
    await p.close();
  }
}
await writeFile(
  "evidence/combat-rework-network.json",
  JSON.stringify(
    { passed: true, results, timestamp: new Date().toISOString() },
    null,
    2,
  ) + "\n",
);
console.log(results.join("\n"));
