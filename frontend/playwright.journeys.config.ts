import { defineConfig } from "@playwright/test";

const viewports = [
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "tablet", viewport: { width: 768, height: 1024 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
];
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["journeys.spec.ts", "signin.spec.ts"],
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/journey-results.json" }],
  ],
  outputDir: "../artifacts/journey-traces",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    screenshot: "only-on-failure",
  },
  projects: (["chromium", "firefox", "webkit"] as const).flatMap(
    (browserName) =>
      viewports.map(({ name, viewport }) => ({
        name: `${browserName}-${name}`,
        use: { browserName, viewport },
      })),
  ),
});
