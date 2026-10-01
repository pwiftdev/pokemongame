import { test, expect } from "@playwright/test";
import { begin } from "./helpers";

test("first steps, training goals, companion greeting and diagnostics stay accessible", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page, `Journey${Date.now().toString(36)}`, "bulbasaur", "new");
  await expect(page.locator("#quest-tracker .adventure-hint")).toContainText(
    "allowance",
  );
  await page
    .locator('#quest-tracker [data-action="claim:first-friend"]')
    .click();
  await expect(page.locator("#quest-tracker")).toContainText("silent orchard");
  await expect(page.locator("#story-direction")).toContainText("north");
  await page.locator('[data-action="greet-companion"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            __islandMetrics: { characterNames: { mood: string }[] };
          }
        ).__islandMetrics.characterNames.some((p) => p.mood === "celebrate"),
      ),
    )
    .toBe(true);
  await page.keyboard.press("c");
  await expect(page.locator(".training-goals").first()).toContainText(
    "Ivysaur",
  );
  await page.keyboard.press("Escape");
  await page.locator('.hud-top [data-action="panel:settings"]').click();
  await page.locator('[data-detail="performance"] summary').click();
  await expect(page.locator("#performance-readout")).toContainText("FPS");
  await page.screenshot({ path: "evidence/journey-performance-panel.png" });
  expect(errors).toEqual([]);
});

test("friend invitation selects the island without sharing an identity and explorers appear on the map", async ({
  browser,
}) => {
  test.setTimeout(150000);
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:2567";
  const aContext = await browser.newContext({ baseURL: base }),
    bContext = await browser.newContext({ baseURL: base });
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  try {
    await a.goto(base);
    await begin(a, `Host${Date.now().toString(36)}`, "bulbasaur", "new");
    const code = (await a.locator("#room-code").textContent())!;
    await b.goto(`${base}/?island=${encodeURIComponent(code)}`);
    await expect(b.locator("#start")).toBeEnabled({ timeout: 45000 });
    await expect(b.locator("#world-mode")).toHaveValue("code");
    await expect(b.locator("#world-code")).toHaveValue(code);
    expect(
      await b.evaluate(() => localStorage.getItem("island.token")),
    ).toBeNull();
    await b.locator("#nickname").fill("Field Friend");
    await b.locator("#start").click();
    await b.locator('[data-action="class-confirm"]').click();
    await b.locator('[data-action="starter-confirm"]').click();
    await expect(b.locator("#hud")).toBeVisible();
    await a.locator("#presence").click();
    await expect(a.locator("#explorer-list")).toContainText("Field Friend");
    await expect(a.locator(".explorer-row")).toHaveCount(2);
    await a.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied");
          },
        },
      }),
    );
    await a
      .getByRole("button", { name: "Copy invitation link", exact: true })
      .click();
    await expect(a.locator("#invite-fallback")).toHaveText(
      `Copy this invitation: ${base}/?island=${encodeURIComponent(code)}`,
    );

    await a.screenshot({ path: "evidence/journey-explorers.png" });
    await a
      .getByRole("button", { name: "Find explorers on the map", exact: true })
      .click();
    await expect(a.locator(".map-explorer")).toHaveCount(1);
    await expect(a.locator(".map-explorer")).toHaveAttribute(
      "aria-label",
      "Field Friend location",
    );
    expect(await a.locator("#room-code").textContent()).toBe(
      await b.locator("#room-code").textContent(),
    );
    expect(
      await a.evaluate(() => localStorage.getItem("island.token")),
    ).not.toBe(await b.evaluate(() => localStorage.getItem("island.token")));
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
