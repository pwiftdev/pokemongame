import { expect, test } from "@playwright/test";
import { begin } from "./helpers";

test.use({ reducedMotion: "reduce" });

test("appearance tabs support keyboard navigation and retain edits between categories", async ({
  page,
}) => {
  await page.goto("/character-studio.html");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({
    timeout: 45000,
  });
  const features = page.getByRole("tab", { name: "Features", exact: true });
  await features.click();
  await features.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Hair", exact: true }),
  ).toBeFocused();
  await page.getByLabel("Hairstyle", { exact: true }).selectOption("long");
  await page.getByRole("tab", { name: "Hair", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Style", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Build", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", { name: "Heritage", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(features).toBeFocused();
  await expect(
    page.getByRole("tabpanel", { name: "Features", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Hairstyle", { exact: true })).toHaveValue(
    "long",
  );
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
    [800, 600],
    [390, 844],
    [390, 667],
  ]) {
    await page.setViewportSize({ width, height });
    for (const category of ["Heritage", "Features", "Hair", "Style", "Build"]) {
      await page.getByRole("tab", { name: category, exact: true }).click();
      const overflow = await page
        .locator(".character-creator, .creator-layout, .creator-options")
        .evaluateAll((elements) =>
          elements
            .filter(
              (e) =>
                e.scrollHeight > e.clientHeight + 1 ||
                e.scrollWidth > e.clientWidth + 1,
            )
            .map((e) => e.className),
        );
      expect(overflow, `${width}x${height} ${category}`).toEqual([]);
      const footer = await page.locator(".creator-footer").boundingBox();
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(height);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.getByRole("tab", { name: "Heritage", exact: true }).click();
    await page.screenshot({ path: `evidence/compact-creator-${width}.png` });
  }
});

test("every adventure menu fits its viewport and combat tooltips are keyboard accessible", async ({
  page,
}) => {
  test.setTimeout(120000);
  await begin(page, `Style${Date.now().toString(36)}`, "squirtle", "new");
  await page.waitForTimeout(4500);
  const ability = page.locator('.ability[data-slot="0"]');
  await ability.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(ability).toHaveAttribute("aria-describedby", "game-tooltip");
  await page.locator('.quick-nav [data-action="panel:collection"]').focus();
  await expect(ability).not.toHaveAttribute("aria-describedby");
  await expect(page.getByRole("tooltip")).toBeHidden();
  for (const [width, height] of [
    [1920, 1080],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `evidence/redesign-hud-${width}.png` });
    for (const menu of [
      "collection",
      "pokedex",
      "inventory",
      "quests",
      "map",
      "ledger",
      "settings",
      "appearance",
    ]) {
      const trigger =
        menu === "ledger"
          ? ".balance-pill"
          : menu === "settings" || menu === "appearance"
            ? `.hud-top [data-action="panel:${menu}"]`
            : `.quick-nav [data-action="panel:${menu}"]`;
      await page.locator(trigger).click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
      expect(
        await panel.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      if (menu === "appearance") {
        await expect(
          page.locator('.creator-preview[data-ready="true"]'),
        ).toBeVisible({ timeout: 30000 });
        const save = page.locator('[data-action="appearance-save"]');
        for (const category of [
          "Heritage",
          "Features",
          "Hair",
          "Style",
          "Build",
        ]) {
          await page.getByRole("tab", { name: category, exact: true }).click();
          expect(
            await page
              .locator(".creator-options")
              .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
            `${width} ${category}`,
          ).toBe(true);
        }
        const saveBounds = await save.boundingBox();
        expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(
          bounds!.y + bounds!.height,
        );
        await save.focus();
        await page.keyboard.press("Tab");
        await expect(page.locator(".close-button")).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(save).toBeFocused();
      }
      await page.screenshot({ path: `evidence/redesign-${menu}-${width}.png` });
      if (menu === "inventory") {
        await page
          .getByRole("button", { name: "Visit shop", exact: true })
          .click();
        await expect(page.locator(".panel-shop")).toBeVisible();
        await page.screenshot({ path: `evidence/redesign-shop-${width}.png` });
      }
      await page.locator(".close-button").click();
      await expect(panel).toHaveCount(0);
    }
  }
});
