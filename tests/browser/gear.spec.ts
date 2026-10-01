import { createWalletSession } from "../../scripts/wallet-client";
import { expect, type Page } from "@playwright/test";
import { test } from "./database-fixture";
import { begin, walk } from "./helpers";
import { combatHero } from "./combat-fixture";
import { GEAR_CATALOG } from "../../packages/shared/gear";

const action = (page: Page, name: string) =>
  page.locator(`[data-action="${name}"]`);
async function preview(page: Page) {
  await expect(page.locator('#gear-preview[data-ready="true"]')).toBeVisible({
    timeout: 30000,
  });
}
const characters = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __islandMetrics: {
            characterNames: {
              name: string;
              equipment: Record<string, string>;
              gearMeshes: string[];
            }[];
          };
        }
      ).__islandMetrics.characterNames,
  );

test("armory purchases, try-on, equipment and multiplayer appearances persist", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "island.settings",
        JSON.stringify({ quality: "low", mute: true }),
      ),
    );
  }
  try {
    const name = `Armory${Date.now().toString(36)}`;
    const auth = await createWalletSession(
      process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:2567",
      name,
    );
    await a.addInitScript(
      (token) => localStorage.setItem("island.token", token),
      auth.token,
    );
    await begin(a, name, "bulbasaur", "new", "knight");
    const room = (await a.locator("#room-code").textContent())!;
    await walk(a, 8, -30);
    await a.keyboard.press("i");
    await preview(a);
    await action(a, "gear-tab:shop").click();
    await action(a, "gear-preview:knight-weapon-5").click();
    await preview(a);
    await expect(a.locator(".gear-preview-note")).toContainText(
      "Trying on Astral",
    );
    expect(
      (await characters(a)).find((p) => p.name === name)?.equipment?.weapon,
    ).toBeUndefined();
    await expect(action(a, "gear-buy:knight-weapon-5")).toBeDisabled();
    await action(a, "gear-buy:knight-weapon-1").click();
    await expect(action(a, "gear-equip:knight-weapon-1")).toBeEnabled();
    await action(a, "gear-equip:knight-weapon-1").click();
    await expect(action(a, "gear-equip:knight-weapon-1")).toBeDisabled();
    await expect(a.locator(".gear-totals")).toContainText("+4 weapon power");
    await action(a, "gear-slot:chest").click();
    await action(a, "gear-buy:chest-1").click();
    await action(a, "gear-equip:chest-1").click();
    await expect(a.locator(".gear-totals")).toContainText("176 health");
    await preview(a);
    await a.screenshot({ path: "evidence/gear-starter-armory.png" });
    await a.keyboard.press("Escape");
    await begin(b, `Observer${Date.now().toString(36)}`, "squirtle", room);
    await expect
      .poll(
        async () =>
          (await characters(b)).find((p) => p.name === name)?.equipment?.chest,
      )
      .toBe("chest-1");
    await expect
      .poll(async () =>
        (await characters(b))
          .find((p) => p.name === name)
          ?.gearMeshes.some((m) => m.includes("breastplate")),
      )
      .toBe(true);
    await expect(b.locator("#account-pill")).toContainText("Guest");
    await a.keyboard.press("Enter");
    await a.locator("#chat-input").fill("Equipment and chat together");
    await a.locator("#chat-input").press("Enter");
    await expect(b.locator(".chat-log")).toContainText(
      "Equipment and chat together",
    );
    await b.keyboard.press("Enter");
    await expect(b.locator("#chat-input")).toBeDisabled();
    await b.keyboard.press("Escape");
    await b.keyboard.press("i");
    await action(b, "gear-tab:shop").click();
    await expect(b.locator(".gear-workbench")).toContainText(
      "Connect a Phantom or Solflare wallet to buy equipment",
    );
    await expect(action(b, "gear-buy:mage-weapon-1")).toBeDisabled();
    await b.keyboard.press("Escape");
    await a.keyboard.press("k");
    await expect(a.locator(".skillbook-intro")).toBeVisible();
    await a.keyboard.press("Escape");
    await a.locator("#account-pill").click();
    await expect(a.locator("#panel-title")).toHaveText("$WOP wallet");
    await a.keyboard.press("Escape");
    await a.reload();
    await expect(a.locator("#start")).toBeEnabled({ timeout: 45000 });
    await a.locator("#start").click();
    await expect(a.locator("#hud")).toBeVisible();
    await a.keyboard.press("i");
    await preview(a);
    await expect(a.locator(".gear-totals")).toContainText("+4 weapon power");
    await expect(a.locator(".gear-totals")).toContainText("176 health");
    expect(errors).toEqual([]);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test("complete armor, collectibles and responsive previews use the same character", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await combatHero(page, request, "mage", undefined, (profile) => {
    profile.gear = {
      owned: GEAR_CATALOG.filter(
        (i) => (!i.classId || i.classId === "mage") && i.level <= 10 && !i.goal,
      ).map((i) => i.id),
      equipped: {
        weapon: "mage-weapon-3",
        chest: "chest-3",
        shoulders: "shoulders-3",
        head: "head-3",
        boots: "boots-3",
        back: "banner-traveler",
      },
    };
    profile.quests.bosses = 3;
  });
  await page.keyboard.press("i");
  await preview(page);
  await page.screenshot({ path: "evidence/gear-full-set.png" });
  const canvas = await page.locator("#gear-preview canvas").boundingBox();
  await page.mouse.move(
    canvas!.x + canvas!.width * 0.7,
    canvas!.y + canvas!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvas!.x - 80, canvas!.y + canvas!.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "evidence/gear-back-adornment.png" });
  await expect
    .poll(async () => (await characters(page))[0]?.gearMeshes.length ?? 0)
    .toBeGreaterThan(10);
  await action(page, "gear-tab:collectibles").click();
  await action(page, "gear-claim:sigil-warden").click();
  await action(page, "gear-equip:sigil-warden").click();
  await expect(action(page, "gear-equip:sigil-warden")).toBeDisabled();
  await preview(page);
  await page.screenshot({ path: "evidence/gear-collectibles.png" });
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(action(page, "gear-tab:collectibles")).toBeVisible();
    await page.screenshot({ path: `evidence/gear-layout-${width}.png` });
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Escape");
    await page.keyboard.press("i");
    await preview(page);
  }
  expect(errors).toEqual([]);
});

for (const [classId, race, body] of [
  ["rogue", "elf", "feminine"],
  ["barbarian", "orc", "masculine"],
  ["knight", "dwarf", "feminine"],
] as const) {
  test(`equipment fits ${body} ${race} ${classId}`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await combatHero(page, request, classId, undefined, (profile) => {
      profile.appearance = { ...profile.appearance!, race, body };
      const equipped = {
        weapon: `${classId}-weapon-3`,
        chest: "chest-3",
        shoulders: "shoulders-3",
        boots: "boots-3",
        head: "head-3",
        back: "sigil-grove",
      };
      profile.gear = { owned: Object.values(equipped), equipped };
    });
    await page.keyboard.press("i");
    await preview(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `evidence/gear-${classId}-${race}.png` });
    expect(errors).toEqual([]);
  });
}
