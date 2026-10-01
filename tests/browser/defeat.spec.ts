import { expect } from "@playwright/test";
import { test } from "./database-fixture";
import { randomUUID } from "node:crypto";
import { mutate } from "../../apps/server/src/db";
import { makeCreature } from "../../apps/server/src/gameplay";
import { metrics, walk } from "./helpers";

test("a defeated explorer can walk, reconnect, and heal at the Springhouse", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const auth = await (
    await request.post("http://127.0.0.1:2567/api/session", {
      data: { nickname: "Defeat recovery" },
    })
  ).json();
  await mutate(auth.profile.id, randomUUID(), async (profile) => {
    const creature = makeCreature("pikachu", 5);
    creature.hp = 0;
    profile.creatures = [creature];
    profile.team = [creature.id];
    profile.active = creature.id;
    profile.classId = "mage";
    profile.heroHp = 0;
    profile.claimed = ["first-friend"];
  });
  await page.addInitScript((token) => {
    localStorage.setItem("island.token", token);
    localStorage.setItem("island.nickname", "Defeat recovery");
  }, auth.token);
  const join = async () => {
    await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
    await page.locator("#start").click();
    await expect(page.locator("#defeat-banner")).toBeVisible();
  };
  await page.goto("/");
  await join();
  const before = (await metrics(page)).selfPosition;
  await page.keyboard.down("w");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __islandMetrics: { heroMotion: string } })
            .__islandMetrics.heroMotion,
      ),
    )
    .toBe("Running_A");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  const after = (await metrics(page)).selfPosition;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
  await page.reload();
  await join();
  await walk(page, -9, -19);
  await walk(page, -10, -27);
  await page.keyboard.press("e");
  await expect(page.locator("#defeat-banner")).toBeHidden();
  await page.screenshot({ path: "evidence/defeat-recovered.png" });
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#defeat-banner")).toBeHidden();
  expect(errors).toEqual([]);
});
