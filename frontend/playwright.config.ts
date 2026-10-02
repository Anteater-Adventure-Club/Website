import { defineConfig } from "@playwright/test";
const sizes = [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "views.spec.ts",
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/playwright-results.json" }],
  ],
  outputDir: "../artifacts/test-results",
  use: {
    baseURL: process.env.E2E_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: sizes.map(([width, height]) => ({
    name: `chromium-${width}`,
    use: { browserName: "chromium", viewport: { width, height } },
  })),
});
