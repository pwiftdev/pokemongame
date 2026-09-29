import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5173");
await page.locator("#start").waitFor();
await page.waitForFunction(() => !document.querySelector("#start").disabled, {
  timeout: 30000,
});
await page.screenshot({ path: "evidence/title.png" });
await page.locator("#nickname").fill("Browser Scout");
await page.locator("#start").click();
await page.locator('[data-action="class-confirm"]').click();
await page.locator('[data-action="starter-confirm"]').waitFor();
await page.screenshot({ path: "evidence/starter.png" });
await page.locator('[data-action="starter-confirm"]').click();
await page.locator("#hud").waitFor({ state: "visible" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "evidence/spawn.png" });
console.log(
  JSON.stringify(
    {
      errors,
      title: await page.title(),
      hud: await page.locator("#hud").innerText(),
    },
    null,
    2,
  ),
);
await browser.close();
