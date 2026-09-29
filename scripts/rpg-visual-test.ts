import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { begin, walk, metrics } from "../tests/browser/helpers";
const browser = await chromium.launch({
  channel: "chromium",
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  baseURL: "http://127.0.0.1:5173",
});
const errors: string[] = [],
  views: Record<string, unknown>[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function capture(name: string) {
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `evidence/rpg-${name}.png` });
  const m = await metrics(page);
  views.push({
    name,
    fps: m.fps,
    drawCalls: m.drawCalls,
    position: m.selfPosition,
  });
  console.log(name, Math.round(m.fps) + " fps");
}
async function town() {
  await page.waitForTimeout(8500);
  await page.keyboard.press("m");
  await page.locator('[data-action="travel:waystone-town"]').click();
  await expect
    .poll(async () => Math.abs((await metrics(page)).selfPosition.z + 58))
    .toBeLessThan(2);
  await page.waitForTimeout(600);
}
try {
  await begin(page, "Wayfarer", "squirtle", "new");
  await capture("new-town");
  for (const [x, z] of [
    [0, -90],
    [0, -145],
    [0, -188],
  ])
    await walk(page, x, z);
  await capture("highlands");
  await town();
  for (const [x, z] of [
    [0, -20],
    [-18, -9],
    [-30, -1],
    [-45, -1],
    [-58, 14],
    [-95, 12],
    [-140, -5],
    [-185, 12],
  ])
    await walk(page, x, z);
  await capture("desert");
  await town();
  for (const [x, z] of [
    [0, -25],
    [20, -22],
    [29, 1],
    [29, 14],
    [44, 14],
    [63, 30],
  ])
    await walk(page, x, z);
  await capture("forest");
  for (const [x, z] of [
    [103, 16],
    [143, 5],
    [184, 20],
  ])
    await walk(page, x, z);
  await capture("marsh");
  await town();
  for (const [x, z] of [
    [0, -25],
    [20, -22],
    [29, 1],
    [24, 43],
    [32, 80],
    [32, 110],
    [0, 145],
    [0, 210],
  ])
    await walk(page, x, z);
  await capture("tundra");
  await page.keyboard.press("m");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "evidence/rpg-world-map.png" });
  await expect(page.locator(".map-pin")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await town();
  expect(errors).toEqual([]);
  await writeFile(
    "evidence/rpg-visual.json",
    JSON.stringify({ passed: true, errors, views }, null, 2),
  );
} finally {
  await browser.close();
}
