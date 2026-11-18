import { defineConfig } from "@playwright/test";

// This suite submits real requests to the dedicated local gear demo.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "gear.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5179",
    launchOptions: { executablePath: process.env.GEAR_CHROMIUM_PATH },
    trace: "retain-on-failure",
  },
  outputDir: "../artifacts/gear-demo/traces",
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 834, height: 1112 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
