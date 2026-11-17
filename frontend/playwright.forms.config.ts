import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "event-forms.spec.ts",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/event-forms/results.json" }],
  ],
  outputDir: "../artifacts/event-forms/traces",
  use: {
    actionTimeout: 15000,
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["iPad Pro 11"],
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
