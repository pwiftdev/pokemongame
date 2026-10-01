import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { begin, approachOrchard, enterMeleeRange, metrics } from "./helpers";
test.use({ video: "on" });
async function feel(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __islandMetrics: {
            heroMotion: string;
            heroLegMotion?: string;
            movementSpeed: number;
            jumpHeight: number;
            effectNames: string[];
            fps: number;
          };
        }
      ).__islandMetrics,
  );
}
test("movement stops cleanly, sprint blends and jumps land on authored poses", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page, "Motion review", "bulbasaur", "new", "rogue");
  await page.keyboard.down("w");
  await expect
    .poll(async () => (await feel(page)).heroLegMotion)
    .toBe("Running_A");
  await page.keyboard.down("Shift");
  await expect
    .poll(async () => (await feel(page)).heroLegMotion)
    .toBe("Running_B");
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await feel(page)).movementSpeed).toBe(0);
  const stop = (await metrics(page)).selfPosition;
  await page.waitForTimeout(250);
  const after = (await metrics(page)).selfPosition;
  expect(Math.hypot(after.x - stop.x, after.z - stop.z)).toBeLessThan(0.3);
  await page.keyboard.press("Alt");
  await expect
    .poll(async () => (await feel(page)).jumpHeight, { intervals: [25] })
    .toBeGreaterThan(0.1);
  await page.screenshot({ path: "evidence/feel-jump.png" });
  await expect.poll(async () => (await feel(page)).jumpHeight).toBe(0);
  await expect
    .poll(async () => (await feel(page)).heroMotion)
    .toBe("Idle_Armed");
  await page.keyboard.press("c");
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  await page.keyboard.up("w");
  expect((await feel(page)).movementSpeed).toBe(0);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "evidence/feel-town.png" });
  expect(errors).toEqual([]);
});
test("held weapon attacks alternate authored swings and preserve movement", async ({
  page,
}) => {
  await begin(page, "Blade review", "bulbasaur", "new", "knight");
  await page.locator('[data-action="pet:passive"]').click();
  await approachOrchard(page);
  await page.keyboard.press("Tab");
  await enterMeleeRange(page);
  await page.keyboard.down("1");
  await expect
    .poll(async () => (await feel(page)).heroMotion, { intervals: [25] })
    .toBe("1H_Melee_Attack_Slice_Diagonal");
  await expect
    .poll(async () => (await feel(page)).effectNames, { intervals: [25] })
    .toContain("weapon slash");
  await Promise.all([
    expect
      .poll(async () => (await feel(page)).heroMotion, { intervals: [25] })
      .toBe("1H_Melee_Attack_Slice_Horizontal"),
    (async () => {
      for (const key of ["d", "s"]) {
        await page.keyboard.down(key);
        await page.waitForTimeout(100);
        const moving = await feel(page);
        await page.keyboard.up(key);
        if (moving.heroLegMotion === "Running_A" && moving.movementSpeed > 1)
          return;
      }
      throw new Error("The hero could not sidestep during the weapon attack");
    })(),
  ]);
  await page.keyboard.up("1");
  await page.screenshot({ path: "evidence/feel-sword.png" });
});
test("frost and meteor have distinct readable effects without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await begin(page, "Spell review", "squirtle", "new", "mage");
  await page.locator('[data-action="pet:passive"]').click();
  await approachOrchard(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("2");
  await expect
    .poll(async () => (await feel(page)).effectNames, { intervals: [25] })
    .toContain("frost crystal");
  await page.waitForTimeout(100);
  await page.screenshot({ path: "evidence/feel-frost.png" });
  await page.keyboard.press("3");
  await expect
    .poll(async () => (await feel(page)).heroMotion, { intervals: [25] })
    .toBe("Spellcast_Long");
  await expect
    .poll(async () => (await feel(page)).effectNames, { intervals: [25] })
    .toContain("meteor core");
  await page.waitForTimeout(180);
  await page.screenshot({ path: "evidence/feel-meteor.png" });
  await page.waitForTimeout(1500);
  const performance = await metrics(page);
  const frameTimes = performance.frameMs.slice(-120).sort((a, b) => a - b);
  await writeFile(
    "evidence/feel-performance.json",
    JSON.stringify(
      {
        fps: performance.fps,
        p95FrameMs: frameTimes[Math.floor(frameTimes.length * 0.95)],
        drawCalls: performance.drawCalls,
        errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
