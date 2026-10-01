import { describe, expect, it, vi } from "vitest";
import pg from "pg";
import { createDatabasePool } from "../database-pool.js";
const url =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/pokemon_dollars";
describe("database connection failures", () => {
  it("handles loss of its own idle connection and connects again", async () => {
    const pool = createDatabasePool(url);
    const admin = new pg.Client({ connectionString: url });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(pool.listenerCount("error")).toBe(1);
      await admin.connect();
      const client = await pool.connect();
      const { rows } = await client.query("SELECT pg_backend_pid() AS pid");
      client.release();
      await admin.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
      await expect.poll(() => log.mock.calls.length).toBe(1);
      expect((await pool.query("SELECT 1 AS ok")).rows[0].ok).toBe(1);
    } finally {
      await pool.end();
      await admin.end();
      log.mockRestore();
    }
  });
  it("rejects an interrupted active query and replaces the broken connection", async () => {
    const pool = createDatabasePool(url);
    const admin = new pg.Client({ connectionString: url });
    try {
      await admin.connect();
      const client = await pool.connect();
      const { rows } = await client.query("SELECT pg_backend_pid() AS pid");
      client.on("error", () => {});
      const interrupted = expect(
        client.query("SELECT pg_sleep(10)"),
      ).rejects.toThrow();
      await admin.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
      await interrupted;
      client.release(true);
      expect((await pool.query("SELECT 1 AS ok")).rows[0].ok).toBe(1);
    } finally {
      await pool.end();
      await admin.end();
    }
  });
  it("rejects an unavailable database within the connection deadline", async () => {
    const missing = new URL(url);
    missing.hostname = "127.0.0.1";
    missing.port = "1";
    const pool = createDatabasePool(missing.toString(), {
      connectionTimeoutMillis: 100,
    });
    try {
      await expect(pool.query("SELECT 1")).rejects.toThrow();
    } finally {
      await pool.end();
    }
  });
  it("bounds pool exhaustion and server-side query execution", async () => {
    const pool = createDatabasePool(url, {
      max: 1,
      connectionTimeoutMillis: 100,
      statement_timeout: 50,
    });
    try {
      const client = await pool.connect();
      try {
        await expect(pool.connect()).rejects.toThrow(/timeout/);
      } finally {
        client.release();
      }
      await expect(pool.query("SELECT pg_sleep(1)")).rejects.toThrow(
        /statement timeout/,
      );
      expect((await pool.query("SELECT 1 AS ok")).rows[0].ok).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
