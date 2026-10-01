import express from "express";
import { BRAND } from "../../../packages/shared/data.js";
import { allowedOrigin } from "./config.js";
import { configureProxy } from "./hosting.js";
import { protectHttp, httpError } from "./http-boundary.js";
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
  walletSession,
} from "./db.js";
import { createChallenge, redeemChallenge, validAddress } from "./wallet.js";
import { requestConversion, wopStatus } from "./wop.js";
import { startWopPayouts } from "./wop-payout.js";
import { IslandRoom } from "./room.js";
import { RateLimit } from "./commands.js";

await migrate();
const app = express();
app.disable("x-powered-by");
configureProxy(app);
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
const nickname = z
  .string()
  .trim()
  .min(2)
  .max(18)
  .regex(/^[\p{L}\p{N} _-]+$/u);
app.post(
  "/api/session",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        nickname,
        token: z.string().length(64).optional(),
      })
      .strict()
      .parse(req.body);
    res.json(await session(input.nickname, input.token));
  }),
);
const walletAddress = z.string().refine(validAddress, "Invalid wallet.");
const walletLimit = new RateLimit(20, 60000);
app.use("/api/wallet", (req, res, next) => {
  if (!walletLimit.allow(req.ip ?? "local")) {
    res
      .status(429)
      .json({ message: "Too many sign-in attempts. Please wait." });
    return;
  }
  next();
});
app.post(
  "/api/wallet/challenge",
  asyncRoute(async (req, res) => {
    const input = z.object({ address: walletAddress }).strict().parse(req.body);
    const origin =
      req.headers.origin ||
      process.env.PUBLIC_ORIGIN ||
      `${req.protocol}://${req.get("host") ?? "localhost"}`;
    res.json(createChallenge(input.address, origin));
  }),
);
app.post(
  "/api/wallet/session",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        address: walletAddress,
        nonce: z.string().regex(/^[a-f0-9]{32}$/),
        signature: z.string().max(200),
        nickname: nickname.optional(),
        guestToken: z.string().length(64).optional(),
      })
      .strict()
      .parse(req.body);
    redeemChallenge(input.address, input.nonce, input.signature);
    const result = await walletSession(
      input.address,
      input.nickname,
      input.guestToken,
    );
    if (result.linked) IslandRoom.reloadProfile(result.profile.id);
    res.json(result);
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
  "/api/wop",
  asyncRoute(async (req, res) => {
    res.json(await wopStatus(await identity(req)));
  }),
);
app.post(
  "/api/wop/convert",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        pd: z.number().int().positive().max(1_000_000),
        requestId: z.string().uuid(),
      })
      .strict()
      .parse(req.body);
    const profile = await identity(req);
    const result = await requestConversion(
      profile,
      input.pd,
      `wop-convert:${input.requestId}`,
    );
    IslandRoom.reloadProfile(profile.id);
    res.json({
      applied: result.applied,
      status: await wopStatus(result.profile),
    });
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
app.get("*", (req, res) => {
  if (
    /^\/(?:api|assets)(?:\/|$)/.test(req.path) ||
    path.extname(req.path) ||
    !req.accepts("html")
  ) {
    res.status(404).json({ message: "Not found." });
    return;
  }
  res.sendFile(path.resolve("dist/client/index.html"));
});
app.use(httpError);
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
await startWopPayouts((id) => IslandRoom.reloadProfile(id));
const port = Number(process.env.PORT ?? 2567);
await server.listen(port, "0.0.0.0", undefined, () => protectHttp(http));
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
