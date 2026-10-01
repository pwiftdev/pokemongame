import type { GameAudio } from "../../apps/client/src/audio";
import type { ClassId } from "../../packages/shared/classes";
import { expect, type Page } from "@playwright/test";
export async function begin(
  page: Page,
  name: string,
  starter = "bulbasaur",
  roomCode?: string,
  classId: ClassId = "mage",
) {
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#nickname").fill(name);
  if (roomCode) {
    await page.locator(".world-choice summary").click();
    await page
      .locator("#world-mode")
      .selectOption(roomCode === "new" ? "new" : "code");
    if (roomCode !== "new") await page.locator("#world-code").fill(roomCode);
  }
  await page.locator("#start").click();
  await page.locator(`[data-action="class-select:${classId}"]`).click();
  await page.locator('[data-action="class-confirm"]').click();
  await expect(page.locator('[data-action="starter-confirm"]')).toBeVisible();
  await page
    .locator(
      `[data-action="starter-select:${({ spriglet: "bulbasaur", cindercub: "charmander", brookfin: "squirtle" } as Record<string, string>)[starter] ?? starter}"]`,
    )
    .click();
  await page.locator('[data-action="starter-confirm"]').click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.locator("#world").click({ position: { x: 700, y: 500 } });
}
export async function metrics(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __islandMetrics: {
            selfPosition: { x: number; z: number };
            cameraAlpha: number;
            targetPosition?: { x: number; z: number };
            frameMs: number[];
            fps: number;
            meshes: number;
            vertices: number;
            drawCalls: number;
            players: number;
          };
        }
      ).__islandMetrics,
  );
}
async function steer(
  page: Page,
  pressed: string[],
  dx: number,
  dz: number,
  alpha: number,
) {
  const f = { x: -Math.cos(alpha), z: -Math.sin(alpha) };
  const forward = dx * f.x + dz * f.z,
    right = dx * f.z - dz * f.x;
  const keys: string[] = [];
  if (Math.abs(forward) > 0.3) keys.push(forward > 0 ? "w" : "s");
  if (Math.abs(right) > 0.3) keys.push(right > 0 ? "d" : "a");
  for (const key of pressed)
    if (!keys.includes(key)) await page.keyboard.up(key);
  for (const key of keys)
    if (!pressed.includes(key)) await page.keyboard.down(key);
  return keys;
}
export async function walk(page: Page, x: number, z: number) {
  const start = Date.now();
  let pressed: string[] = [];
  await page.keyboard.down("Shift");
  try {
    while (Date.now() - start < 35000) {
      const m = await metrics(page);
      const dx = x - m.selfPosition.x,
        dz = z - m.selfPosition.z;
      if (Math.hypot(dx, dz) < 1.5) return;
      pressed = await steer(page, pressed, dx, dz, m.cameraAlpha);
      await page.waitForTimeout(100);
    }
    throw new Error(
      `Keyboard movement stuck en route to ${x},${z}: ${JSON.stringify((await metrics(page)).selfPosition)}`,
    );
  } finally {
    for (const key of pressed) await page.keyboard.up(key);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(350);
  }
}

export async function approachOrchard(page: Page) {
  await walk(page, -9, -12);
  await walk(page, -23, 0);
  await walk(page, -30, 0);
  await walk(page, -40, 0);
  await walk(page, -40, 6);
}

export async function enterMeleeRange(page: Page) {
  const start = Date.now();
  let pressed: string[] = [];
  try {
    while (Date.now() - start < 10000) {
      const m = await metrics(page);
      if (!m.targetPosition) throw new Error("No selected creature");
      const dx = m.targetPosition.x - m.selfPosition.x,
        dz = m.targetPosition.z - m.selfPosition.z;
      if (Math.hypot(dx, dz) <= 2.4) return;
      pressed = await steer(page, pressed, dx, dz, m.cameraAlpha);
      await page.waitForTimeout(80);
    }
    throw new Error("Could not reach the moving target within melee range");
  } finally {
    for (const key of pressed) await page.keyboard.up(key);
  }
}

export async function audioMetrics(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __audioMetrics: GameAudio["metrics"] })
        .__audioMetrics,
  );
}
