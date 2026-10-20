const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 300000,
  expect: { timeout: 30000 },
  workers: 1,
  retries: 0,
  outputDir: ".test-runs/browser",
  reporter: [
    ["list"],
    ["json", { outputFile: "evidence/collaboration/browser-results.json" }],
  ],
  use: {
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
