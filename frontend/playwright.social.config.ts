import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "social.spec.ts",
  reporter: [
    ["list"],
    ["json", { outputFile: "../artifacts/social-results.json" }],
  ],
  outputDir: "../artifacts/social-traces",
  projects: [
    ...base.projects!,
    ...(["firefox", "webkit"] as const).flatMap((browserName) =>
      [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ].map((viewport) => ({
        name: `${browserName}-${viewport.width}`,
        use: { browserName, viewport },
      })),
    ),
  ],
});
