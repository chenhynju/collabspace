const { spawnSync } = require("node:child_process");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, ".."),
  file = resolve(root, ".test-runs/collab-local/config.json");
const env = {
  ...process.env,
  ...(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}),
};
const tests = [
  "packages/collab-store/tests/core.test.cjs",
  "packages/collab-store/tests/board.test.cjs",
  "packages/collab-store/tests/diagram.test.cjs",
  "packages/collab-store/tests/palette.test.cjs",
  "packages/collab-store/tests/mermaid.test.cjs",
  "packages/collab-store/tests/integration.test.cjs",
  "apps/collab/tests/server.test.cjs",
];
const r = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: true,
});
process.exitCode = r.status ?? 1;
