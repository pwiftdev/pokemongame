import express from "express";
import { BRAND } from "../../../packages/shared/data.js";
import { allowedOrigin } from "./config.js";
import { configureHosting } from "./hosting.js";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { z } from "zod";
import {
  authenticate,
  history,
  leaderboard,
  ledger,
  migrate,
  pool,
  session,
} from "./db.js";
import { IslandRoom } from "./room.js";
import { RateLimit } from "./commands.js";

await migrate();
const app = express();
app.disable("x-powered-by");
configureHosting(app);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!allowedOrigin(origin)) {
    res.status(403).json({ message: "Origin is not allowed." });
    return;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "8kb" }));
const limiter = new RateLimit(90, 60000);
app.use("/api", (req, res, next) => {
  if (!limiter.allow(req.ip ?? "local")) {
    res
      .status(429)
      .json({ message: "Too many requests. Please wait a moment." });
    return;
  }
  next();
});
const asyncRoute =
  (
    fn: (req: express.Request, res: express.Response) => Promise<void>,
  ): express.RequestHandler =>
  (req, res, next) => {
    void fn(req, res).catch(next);
  };
app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      version: "0.1.0",
      capacity: 16,
      rooms: IslandRoom.metrics(),
    });
  }),
);
app.post(
  "/api/session",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        nickname: z
          .string()
          .trim()
          .min(2)
          .max(18)
          .regex(/^[\p{L}\p{N} _-]+$/u),
        token: z.string().length(64).optional(),
      })
      .strict()
      .parse(req.body);
    res.json(await session(input.nickname, input.token));
  }),
);
const identity = (req: express.Request) =>
  authenticate(req.headers.authorization?.replace(/^Bearer /, ""));
app.get(
  "/api/ledger",
  asyncRoute(async (req, res) => {
    res.json(await ledger((await identity(req)).id));
  }),
);
app.get(
  "/api/matches",
  asyncRoute(async (req, res) => {
    res.json(await history((await identity(req)).id));
  }),
);
app.get(
  "/api/leaderboard",
  asyncRoute(async (_req, res) => {
    res.json(await leaderboard());
  }),
);
app.use(
  express.static(path.resolve("dist/client"), {
    maxAge: "1h",
    setHeaders(res, file) {
      if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("*", (_req, res) =>
  res.sendFile(path.resolve("dist/client/index.html")),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message =
      error instanceof z.ZodError
        ? "Invalid request."
        : error instanceof Error
          ? error.message
          : "Request failed.";
    const safe = /session|Session|Origin|Invalid|nickname/.test(message);
    if (!safe) console.error("HTTP request failed", error);
    res.status(safe ? 400 : 500).json({
      message: safe
        ? message
        : "Service temporarily unavailable. Your progress has been preserved.",
    });
  },
);
const http = createServer(app);
const server = new Server({
  gracefullyShutdown: false,
  greet: false,
  transport: new WebSocketTransport({
    server: http,
    maxPayload: 8192,
    beforeUpgrade: (_request, context) =>
      allowedOrigin(context.headers.get("origin"))
        ? undefined
        : new Response("Origin is not allowed.", { status: 403 }),
  }),
});
server.define("island", IslandRoom);
const port = Number(process.env.PORT ?? 2567);
await server.listen(port, "0.0.0.0");
console.log(`${BRAND.title} server listening at http://localhost:${port}`);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await server.gracefullyShutdown(false);
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
