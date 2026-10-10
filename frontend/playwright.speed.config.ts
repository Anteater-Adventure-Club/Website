import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "page-speed.spec.ts",
  workers: 1,
  timeout: 30000,
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/page-speed/browser-results.json" }],
  ],
  outputDir: "../artifacts/page-speed/browser-traces",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:18882",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: (["chromium", "firefox", "webkit"] as const).flatMap(
    (browserName) =>
      [390, 1440].map((width) => ({
        name: `${browserName}-${width}`,
        use: {
          browserName,
          viewport: { width, height: width === 390 ? 844 : 900 },
        },
      })),
  ),
});
