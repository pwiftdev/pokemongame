import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { begin, metrics, walk } from "./helpers";
test("two real browser contexts share a world and complete a normalized trainer duel", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contextA = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "evidence/gameplay-video",
      size: { width: 1280, height: 800 },
    },
  });
  const contextB = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  for (const context of [contextA, contextB])
    await context.addInitScript(() =>
      localStorage.setItem(
        "island.settings",
        JSON.stringify({ quality: "low", mute: true }),
      ),
    );
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  const errors: string[] = [];
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(String(e)));
  try {
    await begin(a, `BrowserA${Date.now().toString(36)}`, "spriglet", "new");
    await begin(
      b,
      `BrowserB${Date.now().toString(36)}`,
      "cindercub",
      (await a.locator("#room-code").textContent())!,
    );
    console.log("Both browser identities connected");
    await expect(a.locator("#presence")).toHaveText("2 explorers online");
    await expect(b.locator("#presence")).toHaveText("2 explorers online");
    await walk(a, 0, -20);
    await walk(a, 23, -20);
    await walk(a, 23, -13);
    console.log("First trainer reached arena");
    await walk(b, 0, -20);
    await walk(b, 23, -20);
    await walk(b, 24, -13);
    console.log("Both trainers at arena / opening panel");
    await a.keyboard.press("e");
    await expect(a.locator('[role="dialog"]')).toBeVisible();
    await a.locator('[data-action^="duel:"]').click();
    await a.keyboard.press("Escape");
    await expect(b.locator('[data-action^="duelAccept:"]')).toBeVisible();
    const accept = await b
      .locator('[data-action^="duelAccept:"]')
      .elementHandle();
    await b.waitForTimeout(400);
    expect(await accept!.evaluate((node) => node.isConnected)).toBe(true);
    await b.locator('[data-action^="duelAccept:"]').click();
    await expect(a.locator("#duel-banner")).toContainText(
      "Arena duel in progress",
    );
    await expect(b.locator("#duel-banner")).toContainText(
      "Arena duel in progress",
    );
    const duelBounds = await a.locator("#duel-banner").boundingBox();
    const targetBounds = await a.locator("#target-card").boundingBox();
    expect(duelBounds!.y).toBeGreaterThan(
      targetBounds!.y + targetBounds!.height,
    );
    console.log("Browser duel started");
    for (const page of [a, b])
      await expect(page.locator("[data-slot].locked")).toHaveCount(0);
    await a.screenshot({ path: "evidence/duel.png" });
    for (let i = 0; i < 30; i++) {
      if (!(await a.locator("#duel-banner").isVisible())) break;
      await a.locator('[data-action="ability:0"]').click();
      await a.waitForTimeout(1400);
    }
    await expect(a.locator("#duel-banner")).toBeHidden();
    await expect(b.locator("#duel-banner")).toBeHidden();
    console.log("Both trainers at arena / opening panel");
    await a.keyboard.press("e");
    await expect(a.locator('[role="dialog"]')).toContainText("win");
    await b.keyboard.press("e");
    await expect(b.locator('[role="dialog"]')).toContainText("loss");
    await a.screenshot({ path: "evidence/duel-result.png" });
    expect(errors).toEqual([]);
    await writeFile(
      "evidence/two-browser.json",
      JSON.stringify(
        {
          passed: true,
          contexts: 2,
          independentIdentities: true,
          commands:
            "Real keyboard movement, invitation accept buttons, ability commands until defeat, persisted match history win/loss",
          errors,
          timestamp: new Date().toISOString(),
          metrics: await metrics(a),
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.allSettled([contextA.close(), contextB.close()]);
  }
});
