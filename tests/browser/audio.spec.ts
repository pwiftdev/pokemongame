import { test, expect, type Page } from "@playwright/test";
import { begin } from "./helpers";
interface AudioMetrics {
  state?: string;
  track?: string;
  streams: number;
  voices: number;
  loops: number;
  retiringLoops: number;
  bytes: number;
  played: Record<string, number>;
  levels: Record<string, number>;
}
const audio = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __audioMetrics: AudioMetrics }).__audioMetrics,
  );
test("real browser audio unlocks, crossfades, plays effects and resumes after mute", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/sound-studio.html");
  expect(await audio(page)).toBeUndefined();
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect.poll(async () => (await audio(page))?.track).toBe("town");
  for (const [region, track] of [
    ["forest", "forest"],
    ["tundra", "winter"],
    ["meadow", "meadow"],
  ]) {
    await page.locator(`[data-region="${region}"]`).click();
    await expect.poll(async () => (await audio(page)).track).toBe(track);
    expect((await audio(page)).streams).toBeLessThanOrEqual(2);
  }
  await page.locator("#battle").check();
  await expect.poll(async () => (await audio(page)).track).toBe("combat");
  for (const id of ["step-grass", "fire", "ice", "creature-call", "reward"]) {
    await page.locator(`[data-cue="${id}"]`).click();
    await expect
      .poll(async () => (await audio(page)).played[id] ?? 0)
      .toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await expect.poll(async () => (await audio(page)).state).toBe("suspended");
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect.poll(async () => (await audio(page)).state).toBe("running");
  const m = await audio(page);
  expect(m.voices).toBeLessThanOrEqual(24);
  expect(m.loops + m.retiringLoops).toBeLessThanOrEqual(10);
  expect(m.bytes).toBeLessThanOrEqual(24 * 1024 * 1024);
  await page.screenshot({ path: "evidence/sound-studio.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("missing audio never breaks the interface and sample downloads recover", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let failures = 0;
  await page.route("**/assets/audio/fire-cast.mp3", (route) =>
    ++failures <= 2 ? route.abort() : route.continue(),
  );
  await page.route("**/assets/audio/music-*.mp3", (route) => route.abort());
  await page.goto("/sound-studio.html");
  await page.getByRole("button", { name: "Start listening" }).click();
  await page.locator('[data-cue="fire"]').click();
  await expect.poll(async () => (await audio(page)).played.fire ?? 0).toBe(1);
  expect(failures).toBe(3);
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await expect.poll(async () => (await audio(page)).state).toBe("suspended");
  expect(errors).toEqual([]);
});
test("gameplay footsteps and saved audio channels use the live mixer", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "island.settings",
      JSON.stringify({
        quality: "low",
        music: 0,
        ambience: 0,
        creatures: 0,
        interface: 0.35,
        effects: 0.6,
      }),
    ),
  );
  await begin(page, `Sound${Date.now().toString(36)}`, "bulbasaur", "new");
  await page.keyboard.down("w");
  await page.waitForTimeout(2500);
  await page.keyboard.up("w");
  await expect
    .poll(async () =>
      Object.entries((await audio(page)).played)
        .filter(([id]) => id.startsWith("step-"))
        .reduce((sum, [, n]) => sum + n, 0),
    )
    .toBeGreaterThan(0);
  const m = await audio(page);
  expect(m.levels.music).toBe(0);
  expect(m.levels.ambience).toBe(0);
  expect(m.streams).toBe(0);
  expect(m.loops).toBe(0);
  expect(m.voices).toBeLessThanOrEqual(24);
});
