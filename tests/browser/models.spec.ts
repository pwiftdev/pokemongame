import { expect, test } from "@playwright/test";

for (const category of ["heroes", "village", "nature", "animals", "pokemon"]) {
  test(`failed ${category} models prevent entry and recover on reload`, async ({
    page,
  }) => {
    await page.route(`**/assets/${category}/*.glb`, (route) => route.abort());
    await page.goto("/");
    await expect(page.locator("#loading-status")).toContainText(
      "The island could not load",
      { timeout: 45000 },
    );
    await expect(page.locator("#start")).toBeDisabled();
    await page.unroute(`**/assets/${category}/*.glb`);
    await page.reload();
    await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  });
}

test("every monster plays all six authored actions", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/inspect.html");
  await expect(page.locator("#model-labels button")).toHaveCount(15, {
    timeout: 45000,
  });
  const inspect = () =>
    page.evaluate(() => {
      const state = (
        window as unknown as {
          __assetInspection: { clips: string[]; bones: number[] };
        }
      ).__assetInspection;
      return { clips: state.clips, bones: state.bones };
    });
  for (const motion of [
    "idle",
    "move",
    "attack",
    "hit",
    "defeat",
    "celebrate",
  ]) {
    await page.getByRole("button", { name: motion, exact: true }).click();
    await expect.poll(async () => (await inspect()).clips).toHaveLength(15);
    const before = await inspect();
    await page.waitForTimeout(100);
    const after = await inspect();
    expect(after.bones).not.toEqual(before.bones);
  }
  expect(errors).toEqual([]);
});
