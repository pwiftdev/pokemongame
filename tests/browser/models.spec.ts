import { expect, test } from "@playwright/test";

for (const category of ["characters", "village"]) {
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

for (const category of ["nature", "animals", "world"]) {
  test(`startup ${category} models hold entry and recover before the island opens`, async ({
    page,
  }) => {
    let attempts = 0;
    let recovering = false;
    let recovered = false;
    page.on("response", (response) => {
      if (
        response.url().includes(`/assets/${category}/`) &&
        response.url().endsWith(".glb") &&
        response.ok()
      )
        recovered = true;
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(`**/assets/${category}/*.glb`, (route) => {
      if (recovering) return route.continue();
      attempts++;
      return route.abort();
    });
    await page.goto("/");
    await expect.poll(() => attempts).toBeGreaterThan(0);
    await expect(page.locator("#start")).toBeDisabled();
    await expect(page.locator("#boot-screen")).toBeVisible();
    const before = attempts;
    expect(before).toBeGreaterThan(0);
    recovering = true;
    await expect.poll(() => recovered).toBe(true);
    await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
    expect(errors).toEqual([]);
  });
}

test("a Pokémon model recovers on the same visible actors after a failed download", async ({
  page,
}) => {
  let first = true;
  await page.route("**/assets/pokemon/*.glb", (route) => {
    if (first) {
      first = false;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/pokemon-benchmark.html");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __islandMetrics?: { loadedPokemon: number };
              }
            ).__islandMetrics?.loadedPokemon ?? 0,
        ),
      { timeout: 45000 },
    )
    .toBe(30);
  expect(first).toBe(false);
});

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

test("missing Pokémon models keep entry locked instead of showing placeholders", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/assets/pokemon/*.glb", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#boot-screen")).toHaveAttribute(
    "data-failed",
    "true",
    { timeout: 45000 },
  );
  await expect(page.locator("#start")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Retry loading", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
