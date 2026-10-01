import { test, expect, type Page } from "@playwright/test";
import { begin } from "./helpers";
const names = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __islandMetrics: {
            characterNames: {
              name: string;
              pet: string;
              appearance: { race: string; body: string; hairStyle: string };
              nameVisible: boolean;
              petVisible: boolean;
            }[];
          };
        }
      ).__islandMetrics.characterNames,
  );

test("character studio saves, cancels, reconnects and shares player and pet names", async ({
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
    await begin(a, `Creator${Date.now().toString(36)}`, "bulbasaur", "new");
    await a
      .getByRole("button", { name: "Character studio", exact: true })
      .click();
    await expect(a.locator('[data-ready="true"]')).toBeVisible({
      timeout: 30000,
    });
    await a.locator('[data-race="elf"]').click();
    await a.getByRole("tab", { name: "Features", exact: true }).click();
    await a.getByLabel("Body", { exact: true }).selectOption("feminine");
    await a.locator('[data-tab="hair"]').click();
    await a.getByLabel("Hairstyle", { exact: true }).selectOption("long");
    await a.locator('[data-tab="style"]').click();
    await a.getByLabel("Explorer name", { exact: true }).fill("Sylva Moon");
    await a.locator('[data-action="appearance-save"]').click();
    await expect(a.locator('[role="dialog"]')).toBeHidden();
    await expect
      .poll(async () =>
        (await names(a)).some(
          (p) =>
            p.name === "Sylva Moon" &&
            p.appearance.race === "elf" &&
            p.appearance.body === "feminine",
        ),
      )
      .toBe(true);
    await a.keyboard.press("c");
    await a.locator('[id^="pet-name-"]').first().fill("Little Leaf");
    await a
      .getByRole("button", { name: "Save name", exact: true })
      .first()
      .click();
    await expect(a.locator(".creature-card h3").first()).toHaveText(
      "Little Leaf",
    );
    await a.keyboard.press("Escape");
    const room = (await a.locator("#room-code").textContent())!;
    await begin(b, `Viewer${Date.now().toString(36)}`, "charmander", room);
    await expect
      .poll(async () =>
        (await names(b)).some(
          (p) =>
            p.name === "Sylva Moon" &&
            p.pet === "Little Leaf" &&
            p.appearance.hairStyle === "long" &&
            p.nameVisible &&
            p.petVisible,
        ),
      )
      .toBe(true);
    await a.screenshot({ path: "evidence/character-multiplayer.png" });
    await a
      .getByRole("button", { name: "Character studio", exact: true })
      .click();
    await a.locator('[data-race="orc"]').click();
    await a.keyboard.press("Escape");
    await expect
      .poll(
        async () =>
          (await names(a)).find((p) => p.name === "Sylva Moon")?.appearance
            .race,
      )
      .toBe("elf");
    await a.reload();
    await expect(a.locator("#start")).toBeEnabled({ timeout: 45000 });
    await a.locator("#start").click();
    await expect(a.locator("#hud")).toBeVisible();
    await expect
      .poll(async () =>
        (await names(a)).some(
          (p) =>
            p.name === "Sylva Moon" &&
            p.pet === "Little Leaf" &&
            p.appearance.race === "elf",
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});

test("creator preview supports all races, bodies and responsive layouts", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/character-studio.html");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({
    timeout: 30000,
  });
  for (const race of ["human", "elf", "dwarf", "orc"])
    for (const body of ["masculine", "feminine"]) {
      await page.getByRole("tab", { name: "Heritage", exact: true }).click();
      await page.locator(`[data-race="${race}"]`).click();
      await page.getByRole("tab", { name: "Features", exact: true }).click();
      await page.getByLabel("Body", { exact: true }).selectOption(body);
      await page.waitForTimeout(250);
      await expect(page.locator(".creator-preview-status")).toBeEmpty();
    }
  await page.getByRole("tab", { name: "Heritage", exact: true }).click();
  await page.locator('[data-race="human"]').click();
  await page.waitForTimeout(150);
  const resources = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __characterStudioMetrics: Record<string, number>;
          }
        ).__characterStudioMetrics,
    );
  const before = await resources();
  for (let i = 0; i < 20; i++) {
    await page.locator(`[data-race="${i % 2 ? "human" : "elf"}"]`).click();
    await page.waitForTimeout(100);
  }
  expect(await resources()).toEqual(before);
  await page.locator('[data-race="orc"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-view="face"]').click();
  await page.screenshot({ path: "evidence/character-female-orc.png" });
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Enter the world" }),
    ).toBeVisible();
    await page.screenshot({
      path: `evidence/character-layout-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("failed previews leave choices usable and closing during downloads is safe", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/assets/characters/**", (route) => route.abort());
  await page.goto("/character-studio.html");
  await expect(page.locator(".creator-preview-status")).toContainText(
    "could not load",
  );
  await page.locator('[data-race="dwarf"]').click();
  await expect(page.locator('[data-race="dwarf"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.unroute("**/assets/characters/**");
  await page.route("**/assets/characters/**", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.continue().catch(() => {});
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Enter the world" }).click();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  expect(errors).toEqual([]);
});

test("character confirmation opens Pokémon selection and back preserves the draft", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#nickname").fill(`First${Date.now().toString(36)}`);
  await page.locator("#start").click();
  await page.locator('[data-race="elf"]').click();
  await page.locator('[data-action="class-select:mage"]').click();
  await page.getByRole("tab", { name: "Hair", exact: true }).click();
  await page.getByLabel("Hairstyle", { exact: true }).selectOption("long");
  await page.locator('[data-action="class-confirm"]').click();
  await expect(page.locator("#starter-screen")).toHaveAttribute(
    "data-step",
    "pokemon",
  );
  await expect(page.locator(".starter-intro h2")).toBeFocused();
  await expect(page.locator(".starter-option")).toHaveCount(3);
  await expect(page.locator("#hud")).toBeHidden();
  expect(
    await page.locator("#starter-screen").evaluate((e) => e.scrollTop),
  ).toBe(0);
  await page.locator('[data-action="starter-select:squirtle"]').click();
  await page.locator('[data-action="starter-back"]').click();
  await expect(page.locator('[data-race="elf"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('[data-action="class-select:mage"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Hair", exact: true }).click();
  await expect(page.getByLabel("Hairstyle", { exact: true })).toHaveValue(
    "long",
  );
  await page.locator('[data-action="class-confirm"]').click();
  await expect(
    page.locator('[data-action="starter-select:squirtle"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "evidence/starter-handoff-800.png" });
  await page.locator('[data-action="starter-confirm"]').click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#starter-screen")).toBeHidden();
  await expect
    .poll(async () =>
      (await names(page)).some(
        (p) => p.appearance.race === "elf" && p.appearance.hairStyle === "long",
      ),
    )
    .toBe(true);
});
