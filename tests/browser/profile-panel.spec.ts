import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { test } from "./database-fixture";
import { mutate } from "../../apps/server/src/db";
import { makeCreature } from "../../apps/server/src/gameplay";

test("background health saves preserve the open move editor and keyboard focus", async ({
  page,
  request,
}) => {
  const auth = await (
    await request.post("http://127.0.0.1:2567/api/session", {
      data: { nickname: "Panel recovery" },
    })
  ).json();
  await mutate(auth.profile.id, randomUUID(), (profile) => {
    const creature = makeCreature("bulbasaur", 5);
    profile.creatures = [creature];
    profile.team = [creature.id];
    profile.active = creature.id;
    profile.classId = "mage";
    profile.heroHp = 10;
  });
  await page.addInitScript((token) => {
    localStorage.setItem("island.token", token);
    localStorage.setItem("island.nickname", "Panel recovery");
  }, auth.token);
  let profiles = 0;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      if (String(frame.payload).includes("profile")) profiles++;
    }),
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.keyboard.press("c");
  const editor = page.locator("details[data-detail]").first();
  await editor.locator("summary").click();
  const select = editor.locator("select").first();
  await select.focus();
  const before = profiles;
  await expect.poll(() => profiles).toBeGreaterThan(before);
  await expect(editor).toHaveAttribute("open", "");
  await expect(select).toBeFocused();
});
