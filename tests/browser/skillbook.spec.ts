import { expect } from "@playwright/test";
import { test } from "./database-fixture";
import { begin, metrics, walk } from "./helpers";
import { combatHero } from "./combat-fixture";
async function effects(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __islandMetrics: { effectNames: string[] } })
        .__islandMetrics.effectNames,
  );
}
test("new heroes start with one skill and can arrange a persistent bar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page, "Skillbook review", "bulbasaur", "new", "rogue");
  await expect(page.locator("#abilities [data-ability]")).toHaveCount(1);
  await page.keyboard.press("k");
  await expect(page.locator(".skillbook-intro")).toContainText(
    "Next: Vanish · Level 2",
  );
  await expect(page.locator(".skillbook-skill.locked")).toHaveCount(8);
  await page.locator("#skill-slot-stab").selectOption("2");
  await page.locator('[data-action="skill-equip:stab"]').click();
  await expect(page.locator('[data-ability="stab"]')).toHaveAttribute(
    "data-slot",
    "2",
  );
  await page.locator("#skill-layout").selectOption("split");
  await page.locator("#skill-labels").uncheck();
  await page.locator('[data-action="skill-style"]').click();
  await expect(
    page.locator(".action-slots.split-slots.hide-skill-names"),
  ).toBeVisible();
  await page.screenshot({ path: "evidence/combat-skillbook-new.png" });
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#start").click();
  await expect(page.locator('[data-ability="stab"]')).toHaveAttribute(
    "data-slot",
    "2",
  );
  await expect(
    page.locator(".action-slots.split-slots.hide-skill-names"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("unlocked Mage skills equip, rebind and blink with visible effects", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await combatHero(page, request, "mage");
  await page.keyboard.press("k");
  await expect(page.locator(".skillbook-skill.locked")).toHaveCount(0);
  await page.locator("#skill-slot-meteor").selectOption("5");
  await page.locator('[data-action="skill-equip:meteor"]').click();
  await expect(page.locator('[data-ability="meteor"]')).toHaveAttribute(
    "data-slot",
    "5",
  );
  await page
    .locator('.skillbook-toolbar [data-action="panel:settings"]')
    .click();
  await page.locator('[data-action="rebind:ability2"]').click();
  await page.keyboard.press("q");
  await expect(page.locator('[data-ability="blink"] kbd')).toHaveText("Q");
  await page.keyboard.press("Escape");
  await walk(page, -12, -5);
  await page.keyboard.down("w");
  await page.waitForTimeout(80);
  await page.keyboard.up("w");
  const before = (await metrics(page)).selfPosition;
  await page.keyboard.press("q");
  await expect
    .poll(() => effects(page), { intervals: [20] })
    .toContain("mobility wake");
  await page.screenshot({ path: "evidence/combat-blink.png" });
  await expect
    .poll(async () => {
      const p = (await metrics(page)).selfPosition;
      return Math.hypot(p.x - before.x, p.z - before.z);
    })
    .toBeGreaterThan(5);
  await page.keyboard.press("k");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: "evidence/combat-skillbook-compact.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Vanish has smoke and leaves the local Rogue visible", async ({
  page,
  request,
}) => {
  await combatHero(page, request, "rogue");
  await page.keyboard.press("2");
  await expect
    .poll(() => effects(page), { intervals: [20] })
    .toContain("vanish smoke");
  await expect(page.locator('[data-tooltip^="aura:stealth:"]')).toBeVisible();
  await page.screenshot({ path: "evidence/combat-vanish.png" });
});

for (const setup of [
  {
    classId: "knight" as const,
    slots: [
      "slash",
      "shield-charge",
      "shield-strike",
      "bulwark",
      "heroic-throw",
      "sweep",
    ],
    key: "5",
    effect: "spectral sword",
  },
  {
    classId: "barbarian" as const,
    slots: ["cleave", "charge", "crush", "ironhide", "whirlwind", "shockwave"],
    key: "6",
    effect: "flying blade",
  },
  {
    classId: "rogue" as const,
    slots: [
      "stab",
      "shadowstep",
      "fan-of-knives",
      "vanish",
      "evasion",
      "ambush",
    ],
    key: "3",
    effect: "flying blade",
  },
  {
    classId: "mage" as const,
    slots: [
      "firebolt",
      "blink",
      "arcane-barrage",
      "frostbolt",
      "meteor",
      "barrier",
    ],
    key: "3",
    effect: "arcane mote",
  },
]) {
  test(`${setup.classId} mobility and advanced skills have distinct effects`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await combatHero(page, request, setup.classId, {
      slots: setup.slots,
      layout: "row",
      labels: true,
    });
    await walk(page, 23, -25);
    await walk(page, 26, -25);
    await page.locator("#presence").click();
    await page.locator('[data-action="panel:arena"]').click();
    await page
      .locator('[data-action="practice-target:training-strikes"]')
      .click();
    if (setup.classId !== "mage") {
      await page.keyboard.press("2");
      await expect
        .poll(() => effects(page), { intervals: [20] })
        .toContain("mobility wake");
      await page.waitForTimeout(900);
      if (setup.classId === "barbarian") {
        await page.keyboard.press("1");
        await page.waitForTimeout(950);
      }
    }
    await page.keyboard.press(setup.key);
    await expect
      .poll(() => effects(page), { intervals: [20] })
      .toContain(setup.effect);
    await page.screenshot({
      path: `evidence/combat-${setup.classId}-advanced.png`,
    });
    await expect(page.locator(".practice-summary")).toContainText("DPS");
    expect(errors).toEqual([]);
  });
}
