import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "bans.spec.ts",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/restrictions-and-bans/results.json" }],
  ],
  outputDir: "../artifacts/restrictions-and-bans/traces",
  use: {
    baseURL: "http://localhost:5173",
    actionTimeout: 15000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "iphone",
      use: {
        ...devices["iPhone 13"],
        screen: undefined,
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "ipad",
      use: {
        ...devices["iPad Pro 11"],
        screen: undefined,
        browserName: "webkit",
        viewport: { width: 834, height: 1112 },
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
