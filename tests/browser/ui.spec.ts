import { expect, test } from "@playwright/test";

test("failed packaged assets show a clear recovery message and load after retry", async ({
  page,
}) => {
  await page.route("**/assets/monsters/*.glb", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#loading-status")).toContainText(
    "The island could not load",
    { timeout: 45000 },
  );
  await expect(page.locator("#start")).toBeDisabled();
  await page.unroute("**/assets/monsters/*.glb");
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("#loading-status")).toContainText(
    "Your island is ready",
  );
});

test("missing guest identity preserves its token until an explicit fresh start", async ({
  page,
}) => {
  const missingToken = "a".repeat(64);
  await page.goto("/");
  await page.evaluate(
    (token) => localStorage.setItem("island.token", token),
    missingToken,
  );
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60_000 });
  await page.locator("#nickname").fill(`Renew ${Date.now().toString(36)}`);
  await page.locator("#start").click();
  await expect(page.locator('[data-action="new-guest"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("island.token"))).toBe(
    missingToken,
  );
  await page.locator('[data-action="new-guest"]').click();
  await expect(page.locator('[data-action="class-confirm"]')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("island.token")),
  ).not.toBe(missingToken);
});

test("guest onboarding, every field menu, settings, and durable resume", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("#title-screen h1")).toContainText("POKÉMON");
  await page.getByRole("button", { name: "Field notes & credits" }).click();
  await expect(page.locator(".panel-credits")).toContainText(
    "Ultimate Monsters",
  );
  await page.keyboard.press("Escape");
  await page.locator("#nickname").fill(`Trail ${Date.now().toString(36)}`);
  await page.locator("#start").click();
  await expect(page.locator(".class-option")).toHaveCount(4);
  await page.locator('[data-action="class-confirm"]').click();
  await expect(page.locator(".starter-option")).toHaveCount(3);
  await page.locator('[data-action="starter-select:squirtle"]').click();
  await expect(
    page.locator('[data-action="starter-select:squirtle"]'),
  ).toHaveClass(/selected/);
  await page.locator('[data-action="starter-confirm"]').click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#companion-card")).toContainText("Squirtle");
  await expect(page.locator(".ability[data-slot]")).toHaveCount(6);
  const token = await page.evaluate(() => localStorage.getItem("island.token"));
  expect(token).toBeTruthy();

  await page.keyboard.press("c");
  await expect(page.locator(".panel-collection")).toContainText("Squirtle");
  await expect(page.locator(".creature-card")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("b");
  await expect(page.locator(".panel-inventory")).toContainText(
    "Taming capsule",
  );
  await page.getByRole("button", { name: "Visit shop" }).click();
  await expect(page.locator(".panel-shop .item-card")).toHaveCount(12);
  await expect(page.locator(".panel-shop")).toContainText("Mira");
  await page.keyboard.press("Escape");

  await page.keyboard.press("j");
  await expect(page.locator(".quest-row")).toHaveCount(22);
  await page
    .locator('.panel-quests [data-action="claim:first-friend"]')
    .click();
  await expect(page.locator("#balance")).toHaveText("220");
  await expect(
    page.locator('.panel-quests [data-action="claim:first-friend"]'),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator(".balance-pill").click();
  await expect(page.locator(".panel-ledger")).toContainText("220");
  await expect(page.locator(".panel-ledger .record-row")).not.toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.keyboard.press("m");
  await expect(page.locator(".map-pin")).toHaveCount(8);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "evidence/rpg-world-map.png" });
  await expect(
    page.locator('[data-action="travel:waystone-forest"]'),
  ).toContainText("Lanternwood");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.locator(".panel-settings")).toBeVisible();
  await page.locator('[data-setting="reducedMotion"]').check();
  await expect(page.locator("body")).toHaveClass(/reduced-motion/);
  await page.locator('[data-setting="quality"]').selectOption("low");
  await page.locator('[data-setting="mute"]').check();
  await page.locator('[data-action="rebind:interact"]').click();
  await page.keyboard.press("r");
  await expect(page.locator('[data-action="rebind:interact"]')).toHaveText("R");
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("#start-label")).toHaveText(
    "Continue your adventure",
  );
  await expect(page.locator("body")).toHaveClass(/reduced-motion/);
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#companion-card")).toContainText("Squirtle");
  await expect(page.locator("#balance")).toHaveText("220");
  expect(await page.evaluate(() => localStorage.getItem("island.token"))).toBe(
    token,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-setting="quality"]')).toHaveValue("low");
  await expect(page.locator('[data-setting="mute"]')).toBeChecked();
  await expect(page.locator('[data-action="rebind:interact"]')).toHaveText("R");
  expect(errors).toEqual([]);
});

test("title controls stay reachable on desktop and small screens", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60_000 });
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const box = await page.locator("#start").boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThan(height);
    expect(box!.x + box!.width).toBeLessThan(width);
    await expect(page.locator(".small-screen")).toBeHidden();
  }
  await page.setViewportSize({ width: 600, height: 800 });
  await expect(page.locator(".small-screen")).toBeHidden();
  await expect(page.locator("#start")).toBeVisible();
});
