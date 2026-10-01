import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import pg from "pg";
import { Client } from "colyseus.js";

const base = "http://127.0.0.1:2578";
const namespace = `admission_${randomUUID().replaceAll("-", "")}`;
const dbUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
const admin = new pg.Pool({ connectionString: dbUrl });
let server: ChildProcess;
let serverLog = "";
const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const health = async () =>
  (await (await fetch(base + "/api/health")).json()) as {
    rooms: { roomId: string }[];
  };
const session = async () =>
  (await (
    await post("/api/session", { nickname: "Boundary test" })
  ).json()) as { token: string };
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  const url = new URL(dbUrl);
  url.searchParams.set("options", `-c search_path=${namespace}`);
  server = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        PORT: "2578",
        ALLOWED_ORIGINS: base,
        DYNO: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (chunk) => {
    serverLog += String(chunk);
  });
  server.stderr?.on("data", (chunk) => {
    serverLog += String(chunk);
  });
  await vi.waitFor(
    async () => {
      if (server.exitCode !== null) throw new Error(serverLog);
      expect(
        await fetch(base + "/api/health")
          .then((r) => r.ok)
          .catch(() => false),
      ).toBe(true);
    },
    { timeout: 10000, interval: 100 },
  );
});
afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    const force = setTimeout(() => server.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(force);
  }
  await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await admin.end();
});
describe("actual Colyseus HTTP admission", () => {
  it("rejects invalid credentials and origins before any room exists", async () => {
    expect((await health()).rooms).toHaveLength(0);
    for (const method of ["create", "joinOrCreate", "join", "joinById"]) {
      const response = await post(`/matchmake/${method}/island`, {
        token: "invalid",
      });
      expect(response.ok).toBe(false);
    }
    const blocked = await post("/matchmake/create/island", await session(), {
      Origin: "https://untrusted.example",
    });
    expect(blocked.status).toBe(403);
    expect((await health()).rooms).toHaveLength(0);
  });
  it("keeps normal authenticated WebSocket joins working", async () => {
    const room = await new Client(base).create("island", await session());
    expect((await health()).rooms.some((r) => r.roomId === room.roomId)).toBe(
      true,
    );
    await room.leave();
  });
  it("bounds per-identity creation and total room allocations", async () => {
    const identity = await session();
    for (let i = 0; i < 3; i++)
      expect((await post("/matchmake/create/island", identity)).ok).toBe(true);
    expect((await post("/matchmake/create/island", identity)).status).toBe(429);
    while ((await health()).rooms.length < 8)
      expect((await post("/matchmake/create/island", await session())).ok).toBe(
        true,
      );
    expect(
      (await post("/matchmake/create/island", await session())).status,
    ).toBe(503);
    expect((await health()).rooms).toHaveLength(8);
  });
  it("returns correct missing-file, malformed-body, and size-limit responses", async () => {
    expect((await fetch(base + "/assets/missing.glb")).status).toBe(404);
    for (const path of ["/api/missing", "/api", "/assets"])
      expect((await fetch(base + path)).status).toBe(404);
    expect(
      (
        await post("/api/session", {
          nickname: "Test",
          padding: "x".repeat(9000),
        })
      ).status,
    ).toBe(413);
    expect(
      (await post("/matchmake/create/island", { padding: "x".repeat(9000) }))
        .status,
    ).toBe(413);
    expect(
      (
        await fetch(base + "/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
    ).toBe(400);
  });
  it("rate-limits invalid matchmaking attempts even with spoofed forwarding headers", async () => {
    let limited = false;
    for (let i = 0; i < 65; i++) {
      const response = await post(
        "/matchmake/create/island",
        { token: "invalid" },
        { "X-Forwarded-For": `198.51.100.${i}` },
      );
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
