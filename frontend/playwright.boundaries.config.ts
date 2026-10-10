import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "boundaries.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/boundary-results.json" }],
  ],
  outputDir: "../artifacts/boundary-traces",
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [320, 639, 640, 641, 767, 768, 769, 1023, 1024, 1025]
    .map((width) => ({
      name: `chromium-${width}`,
      use: {
        browserName: "chromium" as const,
        viewport: { width, height: 900 },
      },
    }))
    .concat([
      {
        name: "chromium-200-percent-reflow",
        use: {
          browserName: "chromium" as const,
          viewport: { width: 720, height: 450 },
          deviceScaleFactor: 2,
        },
      },
    ]),
});
