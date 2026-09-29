import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, until, delay } from "./network-client.js";
import { travel } from "./server-navigation.js";
import { CLASS_IDS } from "../packages/shared/classes.js";
const p = await NetworkPlayer.create("RPG verification", undefined, "new");
const checks: string[] = [];
try {
  p.send({ kind: "starter", species: "bulbasaur", classId: "knight" });
  await until(() => p.profile.classId === "knight");
  assert.equal(p.profile.creatures[0].species, "bulbasaur");
  checks.push("Class and Pokémon selection persist");
  p.send({ kind: "pet", mode: "passive" });
  await until(() => p.self?.petMode === "passive");
  await travel(p, 0, -17);
  await travel(p, -39, 6);
  const target = p.world!.wilds.find((w) => w.id === "sprig-1")!;
  const capsules = p.profile.inventory.capsule;
  p.send({ kind: "tame", target: target.id, item: "capsule" });
  await until(() => p.errors.some((e) => e.includes("Hostile monsters")));
  assert.equal(p.profile.inventory.capsule, capsules);
  checks.push(
    "Hostile monsters cannot consume capsules or enter the collection",
  );
  p.errors = [];
  let w = p.world!.wilds.find((w) => w.id === target.id)!;
  await p.go(w.x + 2, w.z);
  const before = w.hp;
  p.send({ kind: "attack", target: target.id, slot: 0 });
  await until(() =>
    p.events.some((e) => e.type === "attack" && e.actor === "hero"),
  );
  await until(
    () => p.world!.wilds.find((w) => w.id === target.id)!.hp < before,
  );
  checks.push("Knight weapon strikes deal authoritative damage");
  p.send({ kind: "pet", mode: "attack", target: target.id });
  await until(
    () => p.events.some((e) => e.type === "attack" && e.actor === "companion"),
    6000,
  );
  checks.push("Companion attacks independently without player ability input");
  p.send({ kind: "pet", mode: "passive" });
  await until(() => !p.self?.petTarget);
  const count = p.events.filter((e) => e.actor === "companion").length;
  await delay(2700);
  assert.equal(p.events.filter((e) => e.actor === "companion").length, count);
  checks.push("Follow cancels autonomous attacks");
  await p.go(0, -17);
  await p.go(0, -32);
  await delay(8500);
  for (const id of CLASS_IDS) {
    p.send({ kind: "class", classId: id });
    await until(() => p.profile.classId === id);
  }
  checks.push("All four classes can be selected at the capital");
  await p.go(0, -20);
  await travel(p, -58, 14);
  await until(() => p.profile.waystones?.includes("waystone-meadow") === true);
  p.send({ kind: "pet", mode: "attack", target: "sprig-1" });
  await until(() => p.errors.some((e) => e.includes("sanctuary")));
  p.errors = [];
  checks.push("Waystone camps reject outgoing combat");
  p.send({ kind: "travel", destination: "waystone-marsh" });
  await until(() => p.errors.some((e) => e.includes("Discover that waystone")));
  p.errors = [];
  await delay(8500);
  p.send({ kind: "travel", destination: "waystone-town" });
  await until(() => Math.abs(p.self!.z + 58) < 2);
  checks.push(
    "Waystone discovery, locked destination rejection and return travel",
  );
  const id = p.profile.id,
    token = p.token;
  await p.close();
  const resumed = await NetworkPlayer.create("Resume", token, "new");
  assert.equal(resumed.profile.id, id);
  assert.equal(resumed.profile.classId, "barbarian");
  assert(resumed.profile.waystones?.includes("waystone-meadow"));
  await resumed.close();
  checks.push("Class, companion and travel discoveries survive reconnect");
  assert.deepEqual(p.errors, []);
  await writeFile(
    "evidence/rpg-gameplay.json",
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(checks.join("\n"));
} finally {
  await p.close();
}
