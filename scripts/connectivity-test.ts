import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { NetworkPlayer, delay, until } from "./network-client.js";
const players: NetworkPlayer[] = [];
const checks: string[] = [];
try {
  const a = await NetworkPlayer.create(
    `Fence${Date.now().toString(36)}`,
    undefined,
    "new",
  );
  players.push(a);
  await a.starter();
  a.room.reconnection.enabled = false;
  const replacement = await NetworkPlayer.create(
    a.profile.nickname,
    a.token,
    a.room.roomId,
  );
  players.push(replacement);
  await until(() => !a.room.connection.isOpen);
  assert.equal(
    replacement.world!.players.filter((p) => p.id === a.profile.id).length,
    1,
  );
  checks.push(
    "A newer token-authenticated session fences the old socket and exposes one player",
  );
  const oldBalance = replacement.profile.balance;
  try {
    a.send({ kind: "claim", quest: "first-friend" });
  } catch {}
  await delay(300);
  assert.equal(replacement.profile.balance, oldBalance);
  checks.push("Fenced socket cannot mutate saved currency");
  const b = await NetworkPlayer.create(
    `Rival${Date.now().toString(36)}`,
    undefined,
    replacement.room.roomId,
  );
  players.push(b);
  await b.starter();
  await replacement.go(23, -13);
  await b.go(23, -13);
  replacement.send({ kind: "queue", join: true });
  b.send({ kind: "queue", join: true });
  await until(() => replacement.world!.duels.some((d) => d.state === "active"));
  const duel = replacement.world!.duels.find((d) => d.state === "active")!;
  replacement.room.reconnection.minUptime = 0;
  let drops = 0,
    reconnections = 0;
  replacement.room.onDrop(() => drops++);
  replacement.room.onReconnect(() => reconnections++);
  const cut = () => {
    const transport = replacement.room.connection.transport as unknown as {
      ws: { terminate?: () => void; close: (code?: number) => void };
    };
    if (transport.ws.terminate) transport.ws.terminate();
    else transport.ws.close(4010);
  };
  cut();
  await until(() => drops > 0, 5000);
  await until(
    () => reconnections > 0 && replacement.room.connection.isOpen,
    12000,
  );
  await until(() =>
    replacement.world!.duels.some(
      (d) => d.id === duel.id && d.state === "active",
    ),
  );
  checks.push(
    "Abrupt transport interruption reconnects inside grace without losing active duel",
  );
  replacement.room.reconnection.enabled = false;
  const before = b.profile.wins;
  const disconnectAt = Date.now();
  cut();
  await until(() => b.profile.wins === before + 1, 26000);
  assert(Date.now() - disconnectAt >= 18000);
  await until(
    () => b.world!.duels.find((d) => d.id === duel.id)?.winner === b.profile.id,
  );
  checks.push(
    "Unrecovered disconnect forfeits after bounded20second grace and frees opponent",
  );
  b.send({ kind: "queue", join: true });
  await until(() => b.world!.queue.includes(b.profile.id));
  b.send({ kind: "queue", join: false });
  await until(() => !b.world!.queue.includes(b.profile.id));
  checks.push(
    "Opponent can immediately queue and cancel after disconnect result",
  );
  console.log(checks.map((c) => `PASS ${c}`).join("\n"));
  await writeFile(
    "evidence/connectivity-test.json",
    JSON.stringify(
      { passed: true, timestamp: new Date().toISOString(), checks },
      null,
      2,
    ),
  );
} finally {
  for (const p of players) p.room.reconnection.enabled = false;
  await Promise.allSettled(players.map((p) => p.close()));
}
