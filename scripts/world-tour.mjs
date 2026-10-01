import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chromium",
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await mkdir("evidence/world-tour", { recursive: true });
await page.routeWebSocket("**", (socket) => socket.close());
await page.goto(
  `${process.env.RENDER_BASE_URL ?? "http://127.0.0.1:2567"}/world-tour.html`,
);
await page.waitForFunction(() => window.__worldTour?.ready, undefined, {
  timeout: 120000,
});
const regions = [
    "town",
    "meadow",
    "forest",
    "ruins",
    "desert",
    "marsh",
    "tundra",
    "highlands",
  ],
  results = [];
for (const quality of ["high", "low"]) {
  await page.evaluate((value) => window.__worldTour.setQuality(value), quality);
  for (let i = 0; i < regions.length; i++) {
    await page.evaluate((index) => window.__worldTour.visit(index), i);
    await page.waitForTimeout(4000);
    const metrics = await page.evaluate(() => window.__islandMetrics);
    results.push({
      region: regions[i],
      quality,
      ...metrics,
      frameMs: undefined,
      cameraCollision: undefined,
    });
    await page.screenshot({
      path: `evidence/world-tour/${regions[i]}${quality === "low" ? "-low" : ""}.png`,
    });
  }
}

await writeFile(
  "evidence/world-tour/results.json",
  JSON.stringify({ results, errors }, null, 2),
);
console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
