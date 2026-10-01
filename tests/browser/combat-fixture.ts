import { createWalletSession } from "../../scripts/wallet-client";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mutate } from "../../apps/server/src/db";
import { makeCreature } from "../../apps/server/src/gameplay";
import type { ClassId } from "../../packages/shared/classes";
import type { CombatLoadout } from "../../packages/shared/skillbook";
import type { Profile } from "../../packages/shared/types";
export async function combatHero(
  page: Page,
  _request: APIRequestContext,
  classId: ClassId,
  combat?: CombatLoadout,
  configure?: (profile: Profile) => void,
) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:2567";
  if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
    throw new Error("Combat fixtures require a local test server.");
  const auth = await createWalletSession(base, `${classId} review`);
  await mutate(auth.profile.id, randomUUID(), (profile) => {
    const c = makeCreature("bulbasaur", 10);
    profile.creatures = [c];
    profile.team = [c.id];
    profile.active = c.id;
    profile.classId = classId;
    profile.combat = combat;
    configure?.(profile);
  });
  await page.addInitScript(
    (token) => localStorage.setItem("island.token", token),
    auth.token,
  );
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#nickname").fill(`${classId} review`);
  await page.locator(".world-choice summary").click();
  await page.locator("#world-mode").selectOption("new");
  await page.locator("#start").click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.locator('[data-action="pet:passive"]').click();
}
