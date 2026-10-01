import { test, expect } from "@playwright/test";
import { installWallet } from "./wallet-fixture";
import { begin } from "./helpers";

for (const kind of ["phantom", "solflare"] as const)
  test(`${kind} Connect signs in without a nickname and resumes the same account`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await installWallet(page, kind);
    await page.goto("/");
    const connect = page.locator(`[data-action="wallet:${kind}"]`);
    await expect(connect).toBeEnabled({ timeout: 60000 });
    await connect.click();
    await expect(page.locator('[data-action="class-confirm"]')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('[data-action="class-confirm"]').click();
    await page.locator('[data-action="starter-confirm"]').click();
    await expect(page.locator("#hud")).toBeVisible();
    await expect(page.locator("#account-pill")).not.toContainText("Guest");
    const token = await page.evaluate(() =>
      localStorage.getItem("island.walletToken"),
    );
    expect(token).toBeTruthy();
    await page.reload();
    await expect(page.locator('[data-action="wallet-continue"]')).toBeEnabled({
      timeout: 60000,
    });
    await page.locator('[data-action="wallet-continue"]').click();
    await expect(page.locator("#hud")).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("island.walletToken")),
    ).toBe(token);
    expect(errors).toEqual([]);
  });

test("guest linking survives repeat clicks, keeps progress, and supports cancellation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await installWallet(page, "phantom");
  await begin(page, `Wallet${Date.now().toString(36)}`, "bulbasaur", "new");
  await page.locator("#account-pill").click();
  await page.evaluate(() => {
    (window as any).walletTest.reject = true;
  });
  await page.locator('[data-action="wallet-link:phantom"]').click();
  await expect(page.locator("#account-pill")).toContainText("Guest");
  await expect(page.locator(".toast").last()).toContainText(/cancel|reject/i);
  await page.evaluate(() => {
    (window as any).walletTest.reject = false;
    (window as any).walletTest.delay = 700;
  });
  await page.locator('[data-action="wallet-link:phantom"]').dblclick();
  await expect(page.locator("#account-pill")).not.toContainText("Guest");
  expect(await page.evaluate(() => (window as any).walletTest.connects)).toBe(
    2,
  );
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#starter-screen")).toBeHidden();
  expect(
    await page.evaluate(() => localStorage.getItem("island.token")),
  ).toBeNull();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator('[data-action="wallet-continue"]')).toBeEnabled({
    timeout: 60000,
  });
  await page.locator('[data-action="wallet-continue"]').click();
  await expect(page.locator("#hud")).toBeVisible();
});
