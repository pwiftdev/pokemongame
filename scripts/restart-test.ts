import { spawn, type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
process.env.SERVER_URL = "http://127.0.0.1:2569";
const { NetworkPlayer, delay, until, base } = await import(
  "./network-client.js"
);
let child: ChildProcess | undefined;
let output = "";
async function start() {
  child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    {
      env: { ...process.env, PORT: "2569" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Restart server failed: ${output}`);
}
async function kill() {
  if (!child) return;
  const current = child;
  await new Promise<void>((resolve) => {
    current.once("exit", () => resolve());
    current.kill("SIGKILL");
  });
  child = undefined;
  await delay(150);
}
const checks: string[] = [];
let resumed: InstanceType<typeof NetworkPlayer> | undefined;
try {
  await start();
  const a = await NetworkPlayer.create(`Crash${Date.now().toString(36)}`);
  await a.starter();
  a.send({ kind: "claim", quest: "first-friend" });
  await until(() => a.profile.claimed.includes("first-friend"));
  const before = structuredClone(a.profile),
    token = a.token;
  await kill();
  await start();
  resumed = await NetworkPlayer.create(before.nickname, token);
  assert.deepEqual(resumed.profile, before);
  checks.push(
    "SIGKILL after acknowledged commit preserves complete profile and balance",
  );
  const requestId = randomUUID(),
    balance = resumed.profile.balance;
  resumed.send({ kind: "claim", quest: "first-friend", requestId });
  await delay(250);
  assert.equal(resumed.profile.balance, balance);
  checks.push("Replay after process restart cannot repeat a quest reward");
  await resumed.close();
  await kill();
  await start();
  resumed = await NetworkPlayer.create(before.nickname, token);
  assert.equal(resumed.profile.balance, balance);
  assert.equal(resumed.world!.duels.length, 0);
  checks.push(
    "Repeated hard restarts preserve durable state and clear transient encounters",
  );
  const ledger = (await fetch(`${base}/api/ledger`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())) as { amount: number }[];
  assert.equal(
    ledger.reduce((n, e) => n + e.amount, 0),
    resumed.profile.balance,
  );
  checks.push(
    "Persisted balance reconciles with append-only ledger after restart",
  );
  console.log(checks.map((c) => `PASS ${c}`).join("\n"));
  await writeFile(
    "evidence/restart-test.json",
    JSON.stringify(
      {
        passed: true,
        timestamp: new Date().toISOString(),
        checks,
        method:
          "Separate process on port2569, real PostgreSQL, SIGKILL (not graceful shutdown). Tokens omitted.",
      },
      null,
      2,
    ),
  );
} finally {
  await resumed?.close();
  await kill();
}
