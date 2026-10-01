import { expect, test } from "@playwright/test";
import { begin } from "./helpers";

test("HUD docks stay separate and menus remain reachable across desktop sizes and scaling", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await begin(page, `Layout ${Date.now().toString(36)}`, "bulbasaur", "new");
  for (const [width, height, scale] of [
    [1920, 1080, 1],
    [1440, 900, 1],
    [1280, 720, 1],
    [1024, 768, 1],
    [800, 600, 1],
    [1280, 720, 1.25],
    [800, 600, 1.25],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator('.hud-top [data-action="panel:settings"]').click();
    await page.locator('[data-setting="scale"]').evaluate((element, value) => {
      (element as HTMLInputElement).value = String(value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, scale);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const selectors = [
        ".party-dock",
        "#abilities",
        ".quick-nav",
        ".quest-tracker",
        ".minimap",
        ".hud-top-right",
      ];
      return Object.fromEntries(
        selectors.map((selector) => {
          const rect = document
            .querySelector(selector)!
            .getBoundingClientRect();
          return [
            selector,
            {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            },
          ];
        }),
      );
    });
    const label = `${width}×${height} at ${scale}`;
    for (const [selector, rect] of Object.entries(layout)) {
      expect(rect.left, `${label}: ${selector} left`).toBeGreaterThanOrEqual(0);
      expect(rect.right, `${label}: ${selector} right`).toBeLessThanOrEqual(
        width + 1,
      );
      expect(rect.top, `${label}: ${selector} top`).toBeGreaterThanOrEqual(0);
      expect(rect.bottom, `${label}: ${selector} bottom`).toBeLessThanOrEqual(
        height + 1,
      );
    }
    for (const [first, second] of [
      [".party-dock", "#abilities"],
      [".party-dock", ".quest-tracker"],
      [".quick-nav", "#abilities"],
      [".quick-nav", ".minimap"],
    ]) {
      const a = layout[first],
        b = layout[second];
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
        `${label}: ${first} overlaps ${second}`,
      ).toBe(true);
    }
    await page.screenshot({ path: `evidence/ui-layout-${width}-${scale}.png` });
    await page.locator('.quick-nav [data-action="panel:pokedex"]').click();
    const panel = page.locator(".panel-pokedex");
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    await page.locator('.panel-nav [data-action="panel:inventory"]').click();
    await expect(page.locator(".panel-inventory")).toBeVisible();
    await page.locator(".close-button").click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  }
});
