import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "retreat.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "../artifacts/retreat-benchmark/browser-results.json" },
    ],
  ],
  outputDir: "../artifacts/retreat-benchmark/traces",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "laptop", use: { viewport: { width: 1366, height: 768 } } },
    { name: "tablet", use: { viewport: { width: 834, height: 1112 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
  ],
});
