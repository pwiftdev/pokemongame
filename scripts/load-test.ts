import { writeFile } from "node:fs/promises";
import { NetworkPlayer, delay, base } from "./network-client.js";
const duration = Number(process.env.LOAD_SECONDS ?? 600);
const count = 16;
const players: NetworkPlayer[] = [];
const start = Date.now();
try {
  for (let i = 0; i < count; i++) {
    const p = await NetworkPlayer.create(
      `Load${Date.now().toString(36)}${i}`,
      undefined,
      i === 0 ? "new" : players[0].room.roomId,
    );
    await p.starter(["spriglet", "cindercub", "brookfin"][i % 3]);
    players.push(p);
  }
  const roomIds = [...new Set(players.map((p) => p.room.roomId))];
  if (roomIds.length !== 1)
    throw new Error(`Expected 16 in one room, got ${roomIds.length}`);
  console.log(
    `16 simulated network clients joined ${roomIds[0]}; exercising for ${duration}s.`,
  );
  const activeStart = Date.now();
  let tick = 0,
    maxGap = 0,
    last = Date.now();
  while (Date.now() - activeStart < duration * 1000) {
    maxGap = Math.max(maxGap, Date.now() - last);
    last = Date.now();
    for (let i = 0; i < count; i++) {
      const p = players[i];
      const angle = tick * 0.025 + i * 0.39;
      p.send({
        kind: "move",
        dx: Math.cos(angle) * 0.7,
        dz: Math.sin(angle) * 0.7,
        sprint: tick % 2 === 0,
        yaw: angle % (Math.PI * 2),
      });
      if (tick % 30 === i % 30) {
        p.send({
          kind: "emote",
          value: ["hello", "cheer", "thanks", "ready"][i % 4],
        });
      }
      if (tick % 50 === i % 50) {
        const me = p.self;
        const target = p.world?.wilds
          .filter((w) => w.hp > 0)
          .sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0), a.z - (me?.z ?? 0)) -
              Math.hypot(b.x - (me?.x ?? 0), b.z - (me?.z ?? 0)),
          )[0];
        if (target) p.send({ kind: "attack", target: target.id, slot: 0 });
      }
      if (tick % 150 === i % 150)
        p.send({ kind: "claim", quest: "first-friend" });
      if (p.events.length > 100) p.events.splice(0, 80);
    }
    tick++;
    if (tick % 600 === 0)
      console.log(
        `Elapsed ${Math.floor((Date.now() - activeStart) / 1000)}s; snapshots ${players.reduce((n, p) => n + p.snapshots, 0)}`,
      );
    await delay(100);
  }
  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  const report = {
    passed:
      players.every((p) => p.room.connection.isOpen) &&
      players.every((p) => p.snapshots > duration * 7),
    clients: count,
    renderedClients: 0,
    durationSeconds: (Date.now() - activeStart) / 1000,
    roomIds,
    health,
    totalSnapshots: players.reduce((n, p) => n + p.snapshots, 0),
    snapshotHz: players.map((p) => +(p.snapshots / duration).toFixed(2)),
    receivedJsonBytes: players.reduce((n, p) => n + p.bytes, 0),
    applicationCommandRejections: players.reduce(
      (n, p) => n + p.errors.length,
      0,
    ),
    sampleRejections: [...new Set(players.flatMap((p) => p.errors))].slice(
      0,
      12,
    ),
    harnessMaxLoopGapMs: maxGap,
    processMemory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    note: "Simulated Colyseus clients; no claim about rendering FPS. JSON byte estimate excludes framing and compression.",
  };
  await writeFile("evidence/load-test.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  await Promise.allSettled(players.map((p) => p.close()));
  console.log(`Total elapsed ${(Date.now() - start) / 1000}s`);
}
