import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NetworkPlayer, delay, until } from "./network-client.js";
import { DEFAULT_APPEARANCE } from "../packages/shared/appearance.js";
const a = await NetworkPlayer.create("Character test", undefined, "new");
const b = await NetworkPlayer.create(
  "Character peer",
  undefined,
  a.room.roomId,
);
async function rejected(send: () => void) {
  const before = a.errors.length;
  send();
  await until(() => a.errors.length > before);
}
try {
  const initial = {
    ...DEFAULT_APPEARANCE,
    race: "orc" as const,
    facialHair: "full" as const,
  };
  a.send({
    kind: "starter",
    species: "bulbasaur",
    classId: "knight",
    appearance: initial,
  });
  await until(() => a.profile.creatures.length > 0);
  await b.starter();
  assert.deepEqual(a.profile.appearance, initial);
  const balance = a.profile.balance,
    stats = structuredClone(a.profile.creatures);
  const appearance = {
    ...initial,
    race: "elf" as const,
    body: "feminine" as const,
    hairStyle: "long" as const,
  };
  const requestId = randomUUID();
  a.send({
    kind: "appearance",
    requestId,
    appearance,
    nickname: "Sylva Verified",
  });
  await until(() => a.profile.nickname === "Sylva Verified");
  assert.deepEqual(a.profile.appearance, appearance);
  assert.equal(a.profile.balance, balance);
  assert.deepEqual(a.profile.creatures, stats);
  await until(
    () =>
      b.world?.players.find((p) => p.id === a.profile.id)?.appearance?.race ===
      "elf",
  );
  a.send({
    kind: "appearance",
    requestId,
    appearance: initial,
    nickname: "Should not save",
  });
  await delay(300);
  assert.equal(a.profile.nickname, "Sylva Verified");
  assert.deepEqual(a.profile.appearance, appearance);
  const pet = a.profile.active!;
  a.send({ kind: "renamePet", creature: pet, nickname: "Little Leaf" });
  await until(
    () =>
      a.profile.creatures.find((p) => p.id === pet)?.nickname === "Little Leaf",
  );
  await until(
    () =>
      b.world?.players.find((p) => p.id === a.profile.id)?.companionName ===
      "Little Leaf",
  );
  await rejected(() =>
    a.send({
      kind: "renamePet",
      creature: b.profile.active,
      nickname: "Not yours",
    }),
  );
  await rejected(() =>
    a.send({ kind: "appearance", appearance: { ...appearance, height: 5 } }),
  );
  assert.ok(!b.profile.creatures[0].nickname);
  a.send({ kind: "renamePet", creature: pet, nickname: "" });
  await until(
    () => a.profile.creatures.find((p) => p.id === pet)?.nickname === "",
  );
  await until(
    () =>
      b.world?.players.find((p) => p.id === a.profile.id)?.companionName ===
      "Bulbasaur",
  );
  await a.close();
  await delay(300);
  a.world = undefined;
  await a.join(b.room.roomId);
  assert.deepEqual(a.profile.appearance, appearance);
  assert.equal(a.profile.nickname, "Sylva Verified");
  a.send({ kind: "pet", mode: "passive" });
  await a.go(0, 40);
  await rejected(() => a.send({ kind: "appearance", appearance: initial }));
  assert.deepEqual(a.profile.appearance, appearance);
  await a.go(0, -20);
  await a.go(23, -20);
  await a.go(23, -13);
  await b.go(0, -20);
  await b.go(23, -20);
  await b.go(24, -13);
  a.send({ kind: "duel", target: b.profile.id });
  await until(
    () =>
      b.world?.duels.some(
        (i) => i.a === a.profile.id && i.state === "invite",
      ) ?? false,
  );
  b.send({
    kind: "duelAccept",
    id: b.world!.duels.find(
      (i) => i.a === a.profile.id && i.state === "invite",
    )!.id,
  });
  await until(() => !!a.self?.duelId);
  await rejected(() => a.send({ kind: "appearance", appearance: initial }));
  assert.deepEqual(a.profile.appearance, appearance);
  console.log(
    "PASS appearance creation, persistence, multiplayer, cosmetic invariants, request replay, pet ownership, validation, name reset, reconnect, town/combat and duel guards",
  );
} finally {
  await a.close();
  await b.close();
}
