import { test, expect } from "@playwright/test";
import { begin, walk } from "./helpers";

test("story board, ranger dialogue, objective markers and Pokémon habitat guide", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page, "Story preview", "squirtle", "new", "knight");
  await page.keyboard.press("j");
  await page.locator('[data-action="claim:first-friend"]').click();
  await expect(
    page.locator('[data-action="accept-quest:story-ranger"]'),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await walk(page, 0, -23);
  await page.keyboard.press("e");
  await expect(page.locator(".quest-dialogue")).toContainText(
    "Rowan’s supply runner",
  );
  await page.locator('[data-action="accept-quest:story-ranger"]').click();
  await expect(page.locator("#quest-tracker")).toContainText("Ranger Rowan");
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 12000 });
  await page.screenshot({ path: "evidence/story-journal.png" });
  await page.keyboard.press("Escape");
  await walk(page, -9, -12);
  await walk(page, -23, 0);
  await walk(page, -25, 5);
  await page.keyboard.press("e");
  await expect(
    page.locator('[data-action="claim:story-ranger"]'),
  ).toBeEnabled();
  await page.locator('[data-action="claim:story-ranger"]').click();
  await page.locator('[data-action="accept-quest:story-orchard"]').click();
  await expect(page.locator("#quest-tracker")).toContainText(
    "Overgrown Orchard",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 12000 });
  await page.screenshot({ path: "evidence/story-ranger.png" });
  await page.keyboard.press("m");
  await expect(page.locator(".habitat-pin.pokemon")).toHaveCount(3);
  await expect(page.locator(".map-objective")).toContainText(
    "Overgrown Orchard",
  );
  await expect(page.locator(".habitat-guide")).toContainText("Squirtle");
  await page.screenshot({ path: "evidence/story-map.png" });
  expect(errors).toEqual([]);
});
