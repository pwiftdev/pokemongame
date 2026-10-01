import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  channel: "chromium",
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const start = Date.now();
await page.goto(
  `${process.env.RENDER_BASE_URL ?? "http://127.0.0.1:2567"}/pokemon-benchmark.html`,
);
await page.waitForFunction(() => window.__pokemonBenchmark?.ready, undefined, {
  timeout: 60000,
});
await page.waitForFunction(
  () => window.__islandMetrics?.loadedPokemon === 30,
  undefined,
  { timeout: 60000 },
);
const loadMs = Date.now() - start;
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
const measure = async () => {
  await page.waitForTimeout(5000);
  const frameMs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let previous = performance.now();
        const started = previous;
        const tick = (now) => {
          samples.push(now - previous);
          previous = now;
          if (now - started >= 30000) resolve(samples);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  return summarize({
    ...(await page.evaluate(() => window.__islandMetrics)),
    frameMs,
  });
};
const high = await measure();
await page.screenshot({ path: "evidence/performance-high.png" });
await page.evaluate(() => window.__pokemonBenchmark.setQuality("low"));
const low = await measure();
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
      resolution: [1440, 900],
      loadMs,
      high,
      low,
      memory,
      transfers,
      totalTransferBytes: transfers.reduce((n, r) => n + r.bytes, 0),
      errors,
      note: "Actual Chromium renderer on this Mac; 30 animated Pokémon in a deterministic snapshot using the production island, camera, lighting, model and effect systems. No network clients in this GPU fixture.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ renderer, loadMs, high, low, errors }, null, 2));
await browser.close();
if (
  errors.length ||
  high.visiblePokemon < 30 ||
  low.visiblePokemon < 30 ||
  high.loadedPokemon !== 30 ||
  low.loadedPokemon !== 30
)
  process.exitCode = 1;
