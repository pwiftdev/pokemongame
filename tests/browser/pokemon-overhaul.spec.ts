import { expect } from "@playwright/test";
import { test } from "./database-fixture";
import { randomUUID } from "node:crypto";
import { mutate } from "../../apps/server/src/db";
import { makeCreature } from "../../apps/server/src/gameplay";
import { walk, metrics, audioMetrics } from "./helpers";

test("Pokémon habitat, commanded VFX, capture, Pokédex and evolution", async ({
  page,
  request,
}) => {
  test.setTimeout(160000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const auth = await (
    await request.post("http://127.0.0.1:2567/api/session", {
      data: { nickname: "Pokemon review" },
    })
  ).json();
  await mutate(auth.profile.id, randomUUID(), async (profile, tx) => {
    const creature = makeCreature("bulbasaur", 12);
    creature.moves = [
      "pk-vine-whip",
      "pk-razor-leaf",
      "pk-synthesis",
      "pk-seed-bomb",
    ];
    profile.creatures = [
      creature,
      makeCreature("charmander", 12),
      makeCreature("squirtle", 12),
    ];
    profile.team = profile.creatures.map((c) => c.id);
    profile.active = creature.id;
    profile.classId = "mage";
    profile.inventory = { capsule: 8, bait: 5, revive: 2 };
    profile.heroHp = undefined;
    profile.claimed = [
      "first-friend",
      "story-ranger",
      "story-orchard",
      "story-satchel",
    ];
    profile.quests["accepted:story-catch"] = 1;
    await tx.credit(profile, 500, "browser fixture", "browser-fixture");
  });
  await page.addInitScript((token) => {
    localStorage.setItem("island.token", token);
    localStorage.setItem("island.nickname", "Pokemon review");
  }, auth.token);
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator(".world-choice summary").click();
  await page.locator("#world-mode").selectOption("new");
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.locator('[data-action="pet:passive"]').click();
  await walk(page, -9, -12);
  await walk(page, -23, 0);
  await walk(page, -40, 2);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+2");
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          (
            window as unknown as { __islandMetrics: { effectNames: string[] } }
          ).__islandMetrics.effectNames.some((name) =>
            name.includes("Razor Leaf"),
          ),
        ),
      { timeout: 12000, intervals: [50] },
    )
    .toBe(true);
  await page.screenshot({ path: "evidence/pokemon-battle-vfx.png" });
  await page.locator('[data-action="pet:passive"]').click();
  await page.keyboard.press("Escape");
  await walk(page, -59, 29);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "evidence/pokemon-habitat.png" });
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    if (
      (await page.locator("#target-card").textContent())?.includes("Bulbasaur")
    )
      break;
  }
  await expect(page.locator("#target-card")).toContainText("Bulbasaur");
  await page.locator('#target-card [data-action="use:bait"]').click();
  await page.waitForTimeout(1700);
  await page.keyboard.press("f");
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          (
            window as unknown as { __islandMetrics: { effectNames: string[] } }
          ).__islandMetrics.effectNames.includes("capture capsule"),
        ),
      { intervals: [50] },
    )
    .toBe(true);
  await page.waitForTimeout(950);
  await page.screenshot({ path: "evidence/pokemon-capture.png" });
  await expect(page.locator("#caught-card")).toBeVisible({ timeout: 8000 });
  expect(
    await page
      .locator("#caught-card h2")
      .evaluate((heading) => heading.scrollWidth <= heading.clientWidth),
  ).toBe(true);
  expect(
    await page.locator(".pet-team button").evaluateAll((buttons) =>
      buttons.every((button) => {
        const key = button.querySelector("kbd")!.getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return (
          key.right <= bounds.right &&
          key.top >= bounds.top &&
          key.bottom <= bounds.bottom
        );
      }),
    ),
  ).toBe(true);
  await expect
    .poll(async () => (await audioMetrics(page)).played?.["capture-shake"] ?? 0)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await audioMetrics(page)).played?.leaf ?? 0)
    .toBeGreaterThan(0);
  await page.screenshot({ path: "evidence/pokemon-caught.png" });
  await page.locator('#caught-card [data-action="panel:pokedex"]').click();
  await expect(page.locator(".dex-grid .dex-card")).toHaveCount(51);
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => {
      const panel = document
        .querySelector(".panel-pokedex")!
        .getBoundingClientRect();
      const controls = document
        .querySelector("#pet-abilities")!
        .getBoundingClientRect();
      const x =
        (Math.max(panel.left, controls.left) +
          Math.min(panel.right, controls.right)) /
        2;
      return !!document
        .elementFromPoint(x, (controls.top + controls.bottom) / 2)
        ?.closest(".panel-pokedex");
    }),
  ).toBe(true);
  await page.screenshot({ path: "evidence/pokemon-pokedex.png" });
  await page.keyboard.press("Escape");
  await walk(page, -54, 2);
  await walk(page, -24, -6);
  await walk(page, -16, -16);
  await page.keyboard.press("c");
  await page.locator('[data-action^="evolve:"]').first().click();
  await page.keyboard.press("Escape");
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          (
            window as unknown as { __islandMetrics: { effectNames: string[] } }
          ).__islandMetrics.effectNames.includes("evolution halo"),
        ),
      { intervals: [50] },
    )
    .toBe(true);
  await page.waitForTimeout(2100);
  await page.screenshot({ path: "evidence/pokemon-evolution.png" });
  await expect(page.locator(".pet-frame")).toContainText("Ivysaur");
  await page.keyboard.press("c");
  await expect(page.locator(".pokemon-stats").first()).toContainText("IV");
  await page.screenshot({ path: "evidence/pokemon-companion-stats.png" });
  expect((await metrics(page)).fps).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
