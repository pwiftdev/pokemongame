import { POKEMON_MODELS } from "../../apps/client/src/roster";
import { test, expect } from "@playwright/test";
import { begin } from "./helpers";

test("designed loader appears before the game module and adapts to small screens", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/assets\/animation-mixer-.*\.js$|\/src\/main\.ts/,
    async (route) => {
      await gate;
      await route.continue().catch(() => {});
    },
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#boot-screen")).toBeVisible();
  await expect(page.locator("#boot-heading")).toHaveText("POKEMON");
  await expect(page.locator("#boot-progress")).toBeVisible();
  await expect(page.locator("#boot-recovery")).toBeHidden();
  await expect(page.locator("#boot-screen img")).toHaveCount(0);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `evidence/loader-${width}.png`,
      fullPage: true,
    });
  }
  release();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 60000 });
  await expect(page.locator("#boot-screen")).toBeHidden();
});

test("entry waits for the final Pokémon model, portraits and a rendered world", async ({
  page,
}) => {
  test.setTimeout(90000);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loaded = new Set<string>();
  page.on("response", (r) => {
    if (r.url().includes("/assets/pokemon/") && r.ok()) loaded.add(r.url());
  });
  await page.route("**/assets/pokemon/Charizard.glb", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => loaded.size, { timeout: 45000 })
    .toBe(POKEMON_MODELS.length - 1);
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#boot-screen")).toBeVisible();
  expect(
    await page
      .locator("#boot-progress")
      .evaluate((bar: HTMLProgressElement) => bar.value < bar.max),
  ).toBe(true);
  release();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await expect(page.locator("#boot-screen")).toBeHidden();
  expect(loaded.size).toBe(POKEMON_MODELS.length);
  await expect(page.locator("#app")).not.toHaveAttribute("inert");
});

test("a missing startup asset blocks entry and retry reloads safely", async ({
  page,
}) => {
  test.setTimeout(90000);
  let broken = true;
  await page.route("**/assets/portraits/Bulbasaur.png", (route) =>
    broken ? route.abort() : route.continue(),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#boot-screen")).toHaveAttribute(
    "data-failed",
    "true",
    { timeout: 45000 },
  );
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#boot-current")).toContainText(
    "Some game files could not load",
  );
  await expect(page.locator("#boot-heading")).toHaveText("POKEMON");
  broken = false;
  await page
    .getByRole("button", { name: "Retry loading", exact: true })
    .click();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await expect(page.locator("#boot-screen")).toBeHidden();
});

test("warmed assets allow onboarding and the world to remain playable", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await begin(page, `Ready${Date.now().toString(36)}`, "charmander", "new");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#boot-screen")).toBeHidden();
  expect(errors).toEqual([]);
});
