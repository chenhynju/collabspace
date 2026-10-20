const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

test("production demo seed rejects missing or short private passwords before database access", () => {
  for (const password of ["", "too-short"]) {
    const run = spawnSync(
      process.execPath,
      [
        require.resolve("ts-node/dist/bin.js"),
        "--transpile-only",
        "prisma/seed.ts",
      ],
      {
        cwd: resolve(__dirname, ".."),
        encoding: "utf8",
        windowsHide: true,
        timeout: 20000,
        env: {
          ...process.env,
          NODE_ENV: "production",
          SEED_PASSWORD: password,
          DATABASE_URL: "postgresql://blocked:blocked@127.0.0.1:1/blocked",
          DATABASE_ADMIN_URL:
            "postgresql://blocked:blocked@127.0.0.1:1/blocked",
        },
      },
    );
    assert.equal(run.status, 1);
    assert.match(
      run.stderr,
      /Production demo initialization requires a private SEED_PASSWORD/,
    );
  }
});
