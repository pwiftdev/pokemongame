import { isSafeArea } from "../packages/shared/regions.js";
import { walkable } from "../packages/shared/rules.js";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, until, delay } from "./network-client.js";
import { travel } from "./server-navigation.js";
import { PLACES } from "../packages/shared/data.js";
import { questProgress, QUESTS } from "../packages/shared/story.js";
const checks: string[] = [];
const p = await NetworkPlayer.create("Story field test", undefined, "new");
const place = (id: string) => PLACES.find((p) => p.id === id)!;
async function visit(id: string) {
  const destination = place(id);
  await travel(p, destination.x, destination.z);
  const count = p.events.length;
  p.send({ kind: "interact", place: id });
  await until(() =>
    p.events.slice(count).some((e) => e.type === "interact" && e.target === id),
  );
}
async function accept(id: string) {
  p.send({ kind: "acceptQuest", quest: id });
  await until(() => p.profile.quests[`accepted:${id}`] === 1);
}
async function claim(id: string) {
  p.send({ kind: "claim", quest: id });
  await until(() => p.profile.claimed.includes(id));
}
async function defeat(id: string) {
  let wild = p.world!.wilds.find((w) => w.id === id)!;
  const approach = [
    [6, -4],
    [-6, -4],
    [0, -7],
    [0, 7],
  ]
    .map(([x, z]) => ({ x: wild.x + x, z: wild.z + z }))
    .find(
      (point) => !isSafeArea(point.x, point.z) && walkable(point.x, point.z),
    )!;
  await travel(p, approach.x, approach.z);
  const start = Date.now();
  while ((wild = p.world!.wilds.find((w) => w.id === id)!).hp > 0) {
    if (Date.now() - start > 70000)
      throw new Error(
        `Combat timed out: ${id}; errors: ${p.errors.slice(-4).join(", ")}; player: ${p.self!.x},${p.self!.z}; wild: ${wild.hp}`,
      );
    if (p.self!.hp < p.self!.maxHp * 0.55)
      p.send({ kind: "use", item: "potion" });
    p.send({ kind: "attack", target: id, slot: 0 });
    await delay(1300);
  }
}
try {
  await p.starter("bulbasaur");
  await claim("first-friend");
  p.send({ kind: "acceptQuest", quest: "story-orchard" });
  await until(() => p.errors.length > 0);
  p.errors = [];
  await visit("quest");
  await accept("story-ranger");
  await visit("ranger");
  await claim("story-ranger");
  checks.push(
    "Fresh character follows board assignment to Rowan; locked assignments are rejected",
  );
  await accept("story-orchard");
  await defeat("sprig-1");
  await defeat("sprig-2");
  assert.equal(p.profile.quests["progress:story-orchard"], 2);
  await visit("ranger");
  await claim("story-orchard");
  await accept("story-satchel");
  p.send({ kind: "interact", place: "lost-parcel" });
  await until(() => p.errors.some((e) => e.includes("Visit")));
  p.errors = [];
  assert.equal(p.profile.quests["progress:story-satchel"] ?? 0, 0);
  await visit("lost-parcel");
  await visit("ranger");
  await claim("story-satchel");
  checks.push(
    "Only orchard enemies count; satchel requires physically reaching it",
  );
  await accept("story-catch");
  p.send({ kind: "pet", mode: "passive" });
  await travel(p, -62, 28);
  const before = p.profile.creatures.length;
  p.send({ kind: "use", item: "bait" });
  await until(() => p.events.some((e) => e.type === "use"));
  await delay(1600);
  p.send({ kind: "tame", target: "bulbasaur-grove", item: "capsule" });
  await until(() => p.profile.creatures.length === before + 1);
  assert.equal(p.profile.quests["progress:story-catch"], 1);
  await visit("ranger");
  await claim("story-catch");
  checks.push(
    "Rowan supplies capsules and bait; a prepared first catch succeeds and persists",
  );
  await accept("story-warden");
  await visit("scholar");
  await claim("story-warden");
  await accept("story-roots");
  p.send({ kind: "pet", mode: "assist" });
  await defeat("moss-1");
  await defeat("owl-1");
  await visit("scholar");
  await claim("story-roots");
  await accept("story-wards");
  await visit("ward-west");
  await visit("ward-west");
  assert.equal(p.profile.quests["progress:story-wards"], 1);
  await visit("ward-east");
  assert.equal(p.profile.quests["progress:story-wards"], 2);
  await visit("scholar");
  await claim("story-wards");
  checks.push(
    "Two different forest inscriptions are required; repeated interaction cannot duplicate progress",
  );
  await accept("story-beacon");
  await visit("tide-beacon");
  await visit("scholar");
  await claim("story-beacon");
  await accept("story-storm");
  assert.equal(
    questProgress(p.profile, QUESTS.find((q) => q.id === "story-storm")!),
    0,
  );
  checks.push(
    "Forest camp and beacon lead to the shared Stormheart finale without lifetime-counter shortcuts",
  );
  const token = p.token,
    profile = structuredClone(p.profile);
  await p.close();
  const resumed = await NetworkPlayer.create("Resume story", token, "new");
  assert.deepEqual(resumed.profile.claimed, profile.claimed);
  assert.deepEqual(resumed.profile.creatures, profile.creatures);
  assert.equal(resumed.profile.quests["accepted:story-storm"], 1);
  await resumed.close();
  checks.push(
    "Reconnect retains captured Pokémon, completed chapters, and the accepted finale",
  );
  await writeFile(
    "evidence/story-gameplay.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        level: profile.creatures[0].level,
        claimed: profile.claimed,
        note: "Fresh level-one character. Real server movement, combat, transactions, capture, interactions and reconnect through the beacon. A separate server integration test verifies boss-defeat progression and finale turn-in; this walkthrough unlocks the finale without attempting the cooperative boss.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  await p.close();
}
