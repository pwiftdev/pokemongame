import { expect } from "@playwright/test";
import { test } from "./database-fixture";
import { randomUUID } from "node:crypto";
import { begin, metrics, walk } from "./helpers";
import { NetworkPlayer, until } from "../../scripts/network-client";
import { mutate } from "../../apps/server/src/db";
import { makeCreature } from "../../apps/server/src/gameplay";

test("explorers challenge each other at their location, accept, surrender and decline", async ({
  page,
}) => {
  test.setTimeout(120000);
  const rival = await NetworkPlayer.create(
    `Rival${Date.now().toString(36)}`,
    undefined,
    "new",
  );
  await rival.starter();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await begin(
      page,
      "World challenger",
      "bulbasaur",
      rival.room.roomId,
      "knight",
    );
    const origin = (await metrics(page)).selfPosition;
    await page.locator("#presence").click();
    await page.locator(`[data-action="duel:${rival.profile.id}"]`).click();
    await expect(page.locator("#duel-banner")).toContainText("Challenge sent");
    await until(() => rival.world!.duels.some((d) => d.state === "invite"));
    rival.send({
      kind: "duelAccept",
      id: rival.world!.duels.find((d) => d.state === "invite")!.id,
    });
    await expect(page.locator("#duel-banner")).toContainText(
      "Friendly duel in progress",
    );
    const current = (await metrics(page)).selfPosition;
    expect(Math.hypot(origin.x - current.x, origin.z - current.z)).toBeLessThan(
      1,
    );
    await page.screenshot({ path: "evidence/world-duel.png" });
    await page.getByRole("button", { name: "Surrender", exact: true }).click();
    await expect(page.locator("#duel-banner")).toBeHidden();
    const self = rival.world!.players.find((p) => p.id !== rival.profile.id)!;
    await until(() => !rival.self!.duelId);
    await page.locator("#presence").click();
    rival.send({ kind: "duel", target: self.id });
    await expect(
      page.getByRole("button", { name: "Decline", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(page.locator("#duel-banner")).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await rival.room.leave();
  }
});

test("training targets show personal combat results and expeditions can start another run", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const auth = await (
    await request.post("http://127.0.0.1:2567/api/session", {
      data: { nickname: "Practice explorer" },
    })
  ).json();
  await mutate(auth.profile.id, randomUUID(), async (profile) => {
    const creature = makeCreature("bulbasaur", 10);
    profile.creatures = [creature];
    profile.team = [creature.id];
    profile.active = creature.id;
    profile.classId = "mage";
    profile.claimed = ["first-friend", "research-meadow"];
    profile.quests = {
      "accepted:expedition-meadow": 1,
      "progress:expedition-meadow": 3,
    };
  });
  await page.addInitScript((token) => {
    localStorage.setItem("island.token", token);
    localStorage.setItem("island.nickname", "Practice explorer");
  }, auth.token);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await walk(page, 0, -25);
  await page.keyboard.press("j");
  await page.locator('[data-detail="repeatable-expeditions"] summary').click();
  await page.locator('[data-action="claim:expedition-meadow"]').click();
  await expect(
    page.locator('[data-action="accept-quest:expedition-meadow"]'),
  ).toBeEnabled();
  await page.locator('[data-action="accept-quest:expedition-meadow"]').click();
  await expect(
    page.locator('[data-action="claim:expedition-meadow"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-action="claim:expedition-meadow"]').locator("../.."),
  ).toContainText("RUN 2");
  await page.screenshot({ path: "evidence/repeatable-expeditions.png" });
  await page.keyboard.press("Escape");
  await walk(page, 23, -25);
  await walk(page, 33, -27);
  await page.locator("#presence").click();
  await page.locator('[data-action="panel:arena"]').click();
  await page
    .locator('[data-action="practice-target:training-strikes"]')
    .click();
  await expect(page.locator(".practice-summary")).toContainText(
    "attack to begin",
  );
  await page.keyboard.press("1");
  await expect(page.locator(".practice-summary")).toContainText("DPS");
  await page.screenshot({ path: "evidence/training-yard.png" });
  await page.locator('[data-action="practice-reset"]').click();
  await expect(page.locator(".practice-summary")).toContainText(
    "attack to begin",
  );
  await page.waitForTimeout(1200);
  await expect(page.locator(".practice-summary")).toContainText(
    "attack to begin",
  );
  expect(errors).toEqual([]);
});
