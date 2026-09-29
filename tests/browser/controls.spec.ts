import { expect, test, type Page } from "@playwright/test";
import { begin, approachOrchard, enterMeleeRange } from "./helpers";
async function state(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __islandMetrics: {
            cameraAlpha: number;
            cameraBeta: number;
            targetId: string | null;
            activeEffects: number;
            cameraCollision: { preferredRadius: number };
          };
        }
      ).__islandMetrics,
  );
}
test("mouse orbit, keyboard orbit, zoom and menu focus work together", async ({
  page,
}) => {
  await begin(page, "Camera review", "spriglet", "new");
  for (const button of ["right", "left"] as const) {
    const before = await state(page);
    await page.mouse.move(700, 450);
    await page.mouse.down({ button });
    await page.mouse.move(900, 420, { steps: 12 });
    await page.mouse.up({ button });
    await expect
      .poll(async () =>
        Math.abs((await state(page)).cameraAlpha - before.cameraAlpha),
      )
      .toBeGreaterThan(0.6);
    expect((await state(page)).targetId).toBe(before.targetId);
  }
  const before = await state(page);
  await page.keyboard.down("q");
  await page.waitForTimeout(300);
  await page.keyboard.up("q");
  expect((await state(page)).cameraAlpha).toBeGreaterThan(
    before.cameraAlpha + 0.2,
  );
  await page.mouse.wheel(0, 300);
  await expect
    .poll(async () => (await state(page)).cameraCollision.preferredRadius)
    .toBeGreaterThan(before.cameraCollision.preferredRadius);
  await page.keyboard.press("c");
  const modal = await state(page);
  await page.keyboard.down("q");
  await page.waitForTimeout(250);
  await page.keyboard.up("q");
  expect((await state(page)).cameraAlpha).toBeCloseTo(modal.cameraAlpha);
  await page.keyboard.press("Escape");
});

test("accepted casts show effects and server cooldowns, rejected casts do not", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await begin(page, "Combat review", "spriglet", "new");
  await page.keyboard.press("1");
  expect((await state(page)).activeEffects).toBe(0);
  await page.keyboard.press("4");
  await expect(page.locator("#combat-status")).toContainText("GUARD ACTIVE");
  await expect(page.locator('.ability[data-slot="3"]')).toBeDisabled();
  await expect
    .poll(async () => (await state(page)).activeEffects)
    .toBeGreaterThan(0);
  await approachOrchard(page);
  await page.keyboard.press("Tab");
  await expect(page.locator("#target-card")).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.locator('.ability[data-slot="0"]')).toBeDisabled();
  await expect
    .poll(async () => (await state(page)).activeEffects)
    .toBeGreaterThan(0);
  await expect(page.locator('.ability[data-slot="0"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a knight fights with its weapon while the companion stays passive", async ({
  page,
}) => {
  await begin(page, "Knight review", "bulbasaur", "new", "knight");
  await page.locator('[data-action="pet:passive"]').click();
  await expect(page.locator('[data-action="pet:passive"]')).toHaveClass(
    /active/,
  );
  await approachOrchard(page);
  await page.keyboard.press("Tab");
  await enterMeleeRange(page);
  await expect(page.locator('.ability[data-slot="0"]')).toContainText(
    "Sword Slash",
  );
  const before = await page.locator("#target-card small").textContent();
  await page.keyboard.press("1");
  await expect(page.locator('.ability[data-slot="0"]')).toBeDisabled();
  await expect
    .poll(() => page.locator("#target-card small").textContent())
    .not.toBe(before);
  await expect
    .poll(async () => (await state(page)).activeEffects)
    .toBeGreaterThan(0);
  await page.screenshot({ path: "evidence/rpg-knight-combat.png" });
});
