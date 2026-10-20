// Runs inherited acceptance against a separate local API, never production.
const {
  readFileSync,
  writeFileSync,
  createWriteStream,
  mkdirSync,
  existsSync,
} = require("node:fs");
const { resolve, join } = require("node:path");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const root = resolve(__dirname, ".."),
  cwd = join(root, "apps/api");
const req = createRequire(join(cwd, "package.json"));
const config = JSON.parse(
  readFileSync(join(root, ".test-runs/collab-local/config.json"), "utf8"),
);
for (const key of ["DATABASE_URL", "DATABASE_ADMIN_URL"]) {
  const url = new URL(config[key]);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5548" ||
    url.pathname !== "/collabspace"
  )
    throw Error("Only the synthetic local database is allowed");
}
const port = 43123,
  dir = join(root, "evidence/collaboration/foundation");
mkdirSync(dir, { recursive: true });
const env = {
  ...process.env,
  ...config,
  APP_PORT: String(port),
  API_BASE: `http://localhost:${port}/api/v1`,
  WS_URL: `http://localhost:${port}`,
  BILLING_WEBHOOK_SECRET: "collabspace-local-synthetic-webhook-only",
  EVIDENCE_DIR: dir,
};
let api, log;
const reports = [
  "acceptance-AT01-AT08.md",
  "acceptance-AT09-im.md",
  "acceptance-AT10-system.md",
];
const previous = new Map(
  reports.map((name) => [
    name,
    existsSync(join(root, "evidence", name))
      ? readFileSync(join(root, "evidence", name))
      : null,
  ]),
);
async function main() {
  await new Promise((resolve, reject) => {
    const probe = require("node:net").createServer();
    probe.once("error", reject);
    probe.listen(port, () => probe.close(resolve));
  });
  api = spawn(process.execPath, ["dist/main.js"], {
    cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  log = createWriteStream(
    join(root, ".test-runs/collab-local/foundation-api.log"),
  );
  api.stdout.pipe(log);
  api.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (api.exitCode !== null)
      throw Error("Isolated API exited before readiness");
    try {
      if (
        (
          await fetch(`${env.API_BASE}/health/ready`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw Error("Isolated acceptance API did not become ready");
  const results = [];
  for (const name of [
    "acceptance.ts",
    "acceptance-im.ts",
    "acceptance-system.ts",
    "acceptance-foundation.ts",
  ]) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          req.resolve("ts-node/dist/bin.js"),
          "--transpile-only",
          `scripts/${name}`,
        ],
        { cwd, env, windowsHide: true, stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("exit", resolve);
    });
    results.push({ script: name, exitCode: code });
  }
  writeFileSync(
    join(dir, "results.json"),
    JSON.stringify(
      { date: new Date().toISOString(), api: env.API_BASE, results },
      null,
      2,
    ),
  );
  if (results.some((r) => r.exitCode !== 0)) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    api?.kill();
    log?.end();
    for (const [name, bytes] of previous) {
      const target = join(root, "evidence", name);
      if (existsSync(target))
        writeFileSync(join(dir, name), readFileSync(target));
      if (bytes) writeFileSync(target, bytes);
    }
  });
