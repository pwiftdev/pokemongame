import type { Express } from "express";
import compression from "compression";

export function configureProxy(app: Express, env = process.env) {
  app.set("trust proxy", env.DYNO ? 1 : false);
}

export function configureHosting(app: Express, env = process.env) {
  configureProxy(app, env);
  app.use(compression());
  if (!env.DYNO) return;
  if (!env.PUBLIC_ORIGIN?.startsWith("https://"))
    throw new Error("Heroku requires an HTTPS PUBLIC_ORIGIN.");
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  app.use((req, res, next) => {
    if (!req.secure) {
      res.redirect(308, `${origin}${req.originalUrl}`);
      return;
    }
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  });
}
