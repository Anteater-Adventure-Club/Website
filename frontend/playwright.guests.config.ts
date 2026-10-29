import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "guest-officers.spec.ts",
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: [["list"]],
  outputDir: "../artifacts/guest-access-traces",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        screen: undefined,
        browserName: "chromium",
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        screen: undefined,
        browserName: "webkit",
      },
    },
  ],
});
