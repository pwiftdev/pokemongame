import { test, expect } from "@playwright/test";
import { begin, metrics } from "./helpers";

test("late room updates cannot render after page cleanup", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  let unloading = false;
  let lateMessages = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => {
    socket.on("framereceived", () => {
      if (unloading) lateMessages++;
    });
  });
  await page.addInitScript(() => {
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (!document.documentElement.hasAttribute("data-test-unloading"))
        send.call(this, data);
    };
  });
  await begin(page, "LeavingTrainer", "bulbasaur", "new");
  const roomCode = await page.locator("#room-code").innerText();
  const peer = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    unloading = true;
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-test-unloading", "");
      window.dispatchEvent(new Event("beforeunload"));
    });
    await begin(peer, "ArrivingTrainer", "charmander", roomCode);
    await expect.poll(async () => (await metrics(peer)).players).toBe(2);
    await expect.poll(() => lateMessages).toBeGreaterThan(10);
    expect(errors).toEqual([]);
    unloading = false;
    await page.reload();
    await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
    await page.locator("#start").click();
    await expect(page.locator("#hud")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await peer.close();
  }
});
