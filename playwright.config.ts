import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 900 },
    headless: true,
    actionTimeout: 10000,
    channel: "chromium",
    launchOptions: {
      args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "evidence/browser-results.json" }],
  ],
});
