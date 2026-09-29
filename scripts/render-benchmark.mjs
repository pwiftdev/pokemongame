import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  channel: "chromium",
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const start = Date.now();
await page.goto("http://127.0.0.1:2567");
await page.waitForFunction(
  () =>
    document.querySelector("#start") &&
    !document.querySelector("#start").disabled,
);
const loadMs = Date.now() - start;
await page.locator("#nickname").fill(`Bench${Date.now().toString(36)}`);
await page.locator("#start").click();
await page.locator('[data-action="class-confirm"]').click();
await page.locator('[data-action="starter-confirm"]').click();
await page.locator("#hud").waitFor({ state: "visible" });
const renderer = await page.evaluate(() => {
  const gl = document.querySelector("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unavailable";
});
const summarize = (m) => {
  const a = m.frameMs.filter((n) => n > 0).sort((a, b) => a - b);
  return {
    ...m,
    frameMs: undefined,
    samples: a.length,
    p50: a[Math.floor(a.length * 0.5)],
    p95: a[Math.floor(a.length * 0.95)],
    p99: a[Math.floor(a.length * 0.99)],
    mean: a.reduce((x, y) => x + y, 0) / a.length,
  };
};
await page.waitForTimeout(30000);
const high = summarize(await page.evaluate(() => window.__islandMetrics));
await page.screenshot({ path: "evidence/performance-high.png" });
await page.locator('#hud [data-action="panel:settings"]').click();
await page.locator('[data-setting="quality"]').selectOption("low");
await page.keyboard.press("Escape");
await page.waitForTimeout(30000);
const low = summarize(await page.evaluate(() => window.__islandMetrics));
await page.screenshot({ path: "evidence/performance-low.png" });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const perf = await cdp.send("Performance.getMetrics");
const transfers = await page.evaluate(() =>
  performance.getEntriesByType("resource").map((r) => ({
    name: r.name.split("/").slice(-1)[0],
    origin: new URL(r.name).origin,
    bytes: r.transferSize,
  })),
);
const memory = perf.metrics.filter((m) =>
  ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents"].includes(m.name),
);
await writeFile(
  "evidence/render-benchmark.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      renderer,
      hardware: {
        platform: os.platform(),
        arch: os.arch(),
        cpu: os.cpus()[0].model,
        ramGB: os.totalmem() / 2 ** 30,
      },
      resolution: [1920, 1080],
      loadMs,
      high,
      low,
      memory,
      transfers,
      totalTransferBytes: transfers.reduce((n, r) => n + r.bytes, 0),
      errors,
      note: "Actual local Chromium Metal request; renderer string records whether GPU or fallback was used. One rendered browser;22wildcreatures, not16renderedplayers.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ renderer, loadMs, high, low, errors }, null, 2));
await browser.close();
