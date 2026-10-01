import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { begin, walk, metrics } from "../tests/browser/helpers.js";
const browser = await chromium.launch({
  channel: "chromium",
  args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
});
const context = await browser.newContext({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:2567",
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: "evidence/world-walkthrough-video",
    size: { width: 1280, height: 800 },
  },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
const scenes: string[] = [];
async function capture(name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `evidence/${name}.png` });
  scenes.push(name);
}
async function inventoryUse(item: string) {
  await page.keyboard.press("b");
  await page.locator(`[data-action="use:${item}"]`).click();
  if (await page.locator('[role="dialog"]').isVisible())
    await page.keyboard.press("Escape");
}
try {
  await begin(page, `Tour${Date.now().toString(36)}`, "spriglet", "new");
  await capture("final-spawn");
  await page.keyboard.press("j");
  await page
    .locator('.panel-quests [data-action="claim:first-friend"]')
    .click();
  await page.keyboard.press("Escape");
  await walk(page, 0, -27);
  await walk(page, 10, -27);
  await page.keyboard.press("e");
  await page.locator('[data-action="buy:prism"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="buy:prism"]').click();
  await page.locator('[data-action="buy:bait"]').click();
  await capture("final-shop");
  await page.keyboard.press("Escape");
  await walk(page, 0, -17);
  await walk(page, -12, -5);
  await page.keyboard.press("Tab");
  await page.keyboard.press("1");
  await page.waitForTimeout(1400);
  await page.keyboard.press("1");
  await capture("final-combat");
  await page.keyboard.press("2");
  await inventoryUse("bait");
  let captured = false;
  for (let i = 0; i < 8; i++) {
    await inventoryUse(i < 2 ? "prism" : "capsule");
    await page.waitForTimeout(1800);
    await capture(i === 0 ? "final-taming" : "final-taming-result");
    await page.keyboard.press("c");
    captured = (await page.locator(".creature-card").count()) > 1;
    await page.keyboard.press("Escape");
    if (captured) break;
    if (i === 2) await inventoryUse("potion");
  }
  if (!captured) throw new Error("No capture after eight attempts");
  await page.keyboard.press("c");
  await capture("final-collection");
  await page.keyboard.press("Escape");
  await walk(page, -28, 6);
  await capture("final-meadow");
  await walk(page, -20, 25);
  await walk(page, 14, 25);
  await walk(page, 28, 30);
  await capture("final-forest");
  await walk(page, 15, 43);
  await walk(page, 15, 57);
  await capture("final-ruins");
  await walk(page, 15, 68);
  await page.keyboard.press("Tab");
  await capture("final-boss");
  await page.waitForTimeout(5500);
  await capture("final-boss-warning");
  await walk(page, 6, 72);
  await expect(page.locator("#companion-card small")).toHaveText(
    /^0 \/ 90 HP/,
    {
      timeout: 60_000,
    },
  );
  await expect(page.locator("#location-name")).toContainText("Hearthwick");
  await expect(page.locator("#target-card")).toBeHidden();
  await capture("final-defeat-recovery");
  await walk(page, -10, -30);
  await page.keyboard.press("e");
  await expect(page.locator("#companion-card small")).toHaveText(
    /^90 \/ 90 HP/,
  );
  await capture("final-springhouse-recovery");
  assert.deepEqual(
    errors,
    [],
    "Browser walkthrough must not raise page errors",
  );
  await writeFile(
    "evidence/visual-walkthrough.json",
    JSON.stringify(
      {
        passed: true,
        timestamp: new Date().toISOString(),
        scenes,
        errors,
        captured,
        recoveredFromDefeat: true,
        method:
          "New level1 player. Real browser keyboard exploration and actual server capture RNG, normal shop purchases. No fixture progress or admin commands.",
        metrics: await metrics(page),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, scenes, errors, captured }));
} finally {
  await context.close();
  await browser.close();
}
