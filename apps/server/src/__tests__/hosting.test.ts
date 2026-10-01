import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { configureProxy, configureHosting } from "../hosting.js";

import { protectHttp } from "../http-boundary.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function start(env: NodeJS.ProcessEnv, wrapped = false) {
  const app = express();
  if (wrapped) configureProxy(app, env);
  else configureHosting(app, env);
  app.get("/probe", (req, res) => res.json({ ip: req.ip, secure: req.secure }));
  app.get("/bundle.js", (_req, res) =>
    res.type("js").send("const game = {};\n".repeat(200)),
  );
  const server = createServer(app);
  if (wrapped) protectHttp(server, env);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Server did not bind");
  return `http://127.0.0.1:${address.port}`;
}

const heroku = { DYNO: "web.1", PUBLIC_ORIGIN: "https://game.example" };

describe("Heroku HTTP boundary", () => {
  it.each([false, true])(
    "compresses large text responses without changing their contents (outer boundary: %s)",
    async (wrapped) => {
      const base = await start(heroku, wrapped);
      const response = await fetch(`${base}/bundle.js`, {
        headers: { "X-Forwarded-Proto": "https", "Accept-Encoding": "gzip" },
      });
      expect(response.headers.get("content-encoding")).toBe("gzip");
      expect(await response.text()).toBe("const game = {};\n".repeat(200));
    },
  );
  it.each([false, true])(
    "redirects HTTP to the configured origin, preserving the path and ignoring a supplied host (outer boundary: %s)",
    async (wrapped) => {
      const base = await start(heroku, wrapped);
      const response = await fetch(`${base}/probe?join=abc`, {
        redirect: "manual",
        headers: {
          Host: "attacker.example",
          "X-Forwarded-Host": "attacker.example",
          "X-Forwarded-Proto": "http",
        },
      });
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        "https://game.example/probe?join=abc",
      );
    },
  );

  it.each([false, true])(
    "uses the router-appended client IP instead of spoofed earlier entries (outer boundary: %s)",
    async (wrapped) => {
      const base = await start(heroku, wrapped);
      for (const ip of ["198.51.100.2", "198.51.100.3"]) {
        const response = await fetch(`${base}/probe`, {
          headers: {
            "X-Forwarded-For": `203.0.113.99, ${ip}`,
            "X-Forwarded-Proto": "https",
          },
        });
        expect(await response.json()).toEqual({ ip, secure: true });
        expect(response.headers.get("strict-transport-security")).toBe(
          "max-age=31536000",
        );
      }
    },
  );

  it.each([false, true])(
    "does not trust forwarded headers or require HTTPS in local development (outer boundary: %s)",
    async (wrapped) => {
      const base = await start({}, wrapped);
      const response = await fetch(`${base}/probe`, {
        headers: {
          "X-Forwarded-For": "203.0.113.99",
          "X-Forwarded-Proto": "https",
        },
      });
      expect(await response.json()).toEqual({ ip: "127.0.0.1", secure: false });
      expect(response.headers.has("strict-transport-security")).toBe(false);
    },
  );

  it("rejects a missing or insecure production origin", () => {
    for (const PUBLIC_ORIGIN of [undefined, "http://game.example"])
      expect(() =>
        configureHosting(express(), { DYNO: "web.1", PUBLIC_ORIGIN }),
      ).toThrow("HTTPS PUBLIC_ORIGIN");
  });
});
