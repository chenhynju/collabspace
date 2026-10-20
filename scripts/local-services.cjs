// Restart web/API/collab without reinitializing or reseeding the local database.
const { readFileSync, writeFileSync, createWriteStream } = require("node:fs");
const { resolve, join } = require("node:path");
const { createRequire } = require("node:module");
const { spawn } = require("node:child_process");
const root = resolve(__dirname, ".."),
  file = join(root, ".test-runs/collab-local/config.json");
const config = JSON.parse(readFileSync(file, "utf8"));
Object.assign(config, {
  WEB_URL: "http://localhost:43120",
  APP_PORT: "43121",
  COLLAB_PORT: "43122",
  COLLAB_WS_URL: "ws://localhost:43122/collab",
  NEXT_PUBLIC_API_URL: "http://localhost:43121/api/v1",
  NEXT_PUBLIC_WS_URL: "http://localhost:43121",
});
writeFileSync(file, JSON.stringify(config, null, 2));
const children = [];
for (const [name, cwd, args] of [
  ["api", "apps/api", ["dist/main.js"]],
  ["collab", "apps/collab", ["src/server.cjs"]],
  [
    "web",
    "apps/web",
    [
      createRequire(join(root, "apps/web/package.json")).resolve(
        "next/dist/bin/next",
      ),
      "dev",
      "-p",
      "43120",
    ],
  ],
]) {
  const p = spawn(process.execPath, args, {
    cwd: join(root, cwd),
    env: { ...process.env, ...config },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = createWriteStream(
    join(root, ".test-runs/collab-local", `${name}.log`),
  );
  p.stdout.pipe(log);
  p.stderr.pipe(log);
  p.on("error", (e) => console.error(name, e));
  p.on("exit", (code) => console.log(`${name} exited: ${code}`));
  children.push(p);
  console.log(`${name}: pid=${p.pid}`);
}
writeFileSync(
  join(root, ".test-runs/collab-local/service-pids.json"),
  JSON.stringify(children.map((p) => p.pid)),
);
function stop() {
  for (const p of children) p.kill();
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
