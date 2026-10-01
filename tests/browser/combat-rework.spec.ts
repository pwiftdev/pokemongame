import { expect, test } from "@playwright/test";
import {
  begin,
  audioMetrics,
  metrics,
  walk,
  approachOrchard,
  enterMeleeRange,
} from "./helpers";

test("mage casts visibly, movement interrupts, and Alt dashes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page, "Cast review", "bulbasaur", "new", "mage");
  await page.locator('[data-action="pet:passive"]').click();
  await walk(page, -9, -12);
  await walk(page, -23, 0);
  await walk(page, -31, 4);
  await page.keyboard.press("Tab");
  await expect(page.locator("#target-card")).toBeVisible();
  expect(
    await page
      .locator("#target-card h3")
      .evaluate((label) => label.scrollWidth <= label.clientWidth),
  ).toBe(true);
  await page.keyboard.press("3");
  await expect(page.locator("#cast-bar")).toBeVisible();
  await expect(page.locator("#cast-bar")).toContainText("Meteor");
  await page.screenshot({ path: "evidence/combat-rework-casting.png" });
  await page.keyboard.down("s");
  await expect(page.locator("#cast-bar")).toBeHidden();
  await page.keyboard.up("s");
  await page.waitForTimeout(400);
  const before = (await metrics(page)).selfPosition;
  await page.keyboard.press("Alt");
  await expect(page.locator('[data-action="dash"]')).toBeDisabled();
  await expect
    .poll(async () => {
      const p = (await metrics(page)).selfPosition;
      return Math.hypot(p.x - before.x, p.z - before.z);
    })
    .toBeGreaterThan(3);
  await page.screenshot({ path: "evidence/combat-rework-dash.png" });
  await expect
    .poll(async () => (await audioMetrics(page)).played?.fire ?? 0)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await audioMetrics(page)).played?.dash ?? 0)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await audioMetrics(page)).track)
    .toBe("combat");
  expect(errors).toEqual([]);
});

test("knight battles enemies with directional windups", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page, "Enemy review", "bulbasaur", "new", "knight");
  await page.locator('[data-action="pet:passive"]').click();
  await approachOrchard(page);
  await page.keyboard.press("Tab");
  await enterMeleeRange(page);
  await page.keyboard.press("4");
  await page.waitForTimeout(250);
  await page.keyboard.press("1");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "evidence/combat-rework-melee.png" });
  await expect(page.locator("#target-card")).toBeVisible();
  await expect(page.locator("#target-card")).not.toContainText("90 / 90");
  expect(errors).toEqual([]);
});
