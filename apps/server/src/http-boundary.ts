import express from "express";
import type { Server as HttpServer, RequestListener } from "node:http";
import { z } from "zod";
import { allowedOrigin } from "./config.js";
import { RateLimit } from "./commands.js";
import { configureHosting } from "./hosting.js";
import { HttpError } from "./errors.js";

export const httpError: express.ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  let status = 503;
  let message = "Service temporarily unavailable. Please try again.";
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (
    error instanceof z.ZodError ||
    error?.type === "entity.parse.failed"
  ) {
    status = 400;
    message = "Invalid request.";
  } else if (error?.type === "entity.too.large") {
    status = 413;
    message = "Request is too large.";
  } else console.error("HTTP request failed", error);
  res.status(status).json({ message });
};

export function protectHttp(server: HttpServer, env = process.env) {
  const handlers = server.listeners("request") as RequestListener[];
  const boundary = express();
  boundary.disable("x-powered-by");
  configureHosting(boundary, env);
  const matchmaking = new RateLimit(60, 60000);
  boundary.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!allowedOrigin(origin))
      return next(new HttpError(403, "Origin is not allowed."));
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.path.startsWith("/matchmake/")) {
      if (!matchmaking.allow(req.ip ?? "local"))
        return next(
          new HttpError(
            429,
            "Too many connection attempts. Please wait a moment.",
          ),
        );
      if (req.method === "POST") {
        const length = Number(req.headers["content-length"]);
        if (
          !Number.isSafeInteger(length) ||
          length < 0 ||
          req.headers["transfer-encoding"]
        )
          return next(new HttpError(411, "A request length is required."));
        if (length > 8192)
          return next(new HttpError(413, "Request is too large."));
      }
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    for (const handler of handlers) handler.call(server, req, res);
  });
  boundary.use(httpError);
  server.removeAllListeners("request");
  server.on("request", boundary);
}
