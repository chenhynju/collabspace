// Disposable local environment. Never reads the original project's .env.
const { createRequire } = require("node:module");
const { resolve, join } = require("node:path");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const { spawn } = require("node:child_process");
const root = resolve(__dirname, ".."),
  apiDir = join(root, "apps/api"),
  req = createRequire(join(apiDir, "package.json"));
const dir = join(root, ".test-runs", "collab-local");
mkdirSync(dir, { recursive: true });
const env = {
  ...process.env,
  DATABASE_ADMIN_URL:
    "postgresql://teamspace:teamspace_dev_pwd@127.0.0.1:5548/collabspace",
  DATABASE_URL:
    "postgresql://teamspace_app:teamspace_app_pwd@127.0.0.1:5548/collabspace",
  JWT_SECRET: "collabspace-local-synthetic-only-change-in-production",
  WEB_URL: "http://localhost:43120",
  APP_PORT: "43121",
  COLLAB_PORT: "43122",
  COLLAB_WS_URL: "ws://localhost:43122/collab",
  NEXT_PUBLIC_API_URL: "http://localhost:43121/api/v1",
  NEXT_PUBLIC_WS_URL: "http://localhost:43121",
  REDIS_URL: "redis://127.0.0.1:6399",
  BILLING_MODE: "sandbox",
  EMAIL_PROVIDER: "console",
  UPLOAD_ROOT: join(dir, "uploads"),
};
function run(args, cwd = apiDir, extra = {}) {
  return new Promise((ok, no) => {
    const p = spawn(process.execPath, args, {
      cwd,
      env: { ...env, ...extra },
      stdio: "inherit",
      windowsHide: true,
    });
    p.on("exit", (c) =>
      c === 0 ? ok() : no(new Error(`Command exited ${c}: ${args[0]}`)),
    );
    p.on("error", no);
  });
}
const children = [];
let pg;
async function main() {
  const mod = await import(
    require("node:url").pathToFileURL(req.resolve("embedded-postgres")).href
  );
  const Embedded = mod.default || mod.EmbeddedPostgres;
  pg = new Embedded({
    databaseDir: join(dir, "pgdata"),
    user: "teamspace",
    password: "teamspace_dev_pwd",
    port: 5548,
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1", "-c", "listen_addresses=127.0.0.1"],
  });
  if (!existsSync(join(dir, "pgdata", "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const { Client } = require("../packages/collab-store/node_modules/pg");
  const admin = new Client({
    connectionString: env.DATABASE_ADMIN_URL.replace(
      "/collabspace",
      "/postgres",
    ),
  });
  await admin.connect();
  if (
    !(
      await admin.query("SELECT 1 FROM pg_database WHERE datname='collabspace'")
    ).rowCount
  )
    await admin.query("CREATE DATABASE collabspace");
  await admin.end();
  await run([req.resolve("prisma/build/index.js"), "generate"]);
  await run(
    [req.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"],
    apiDir,
    { DATABASE_URL: env.DATABASE_ADMIN_URL },
  );
  if (!existsSync(join(dir, "seeded"))) {
    await run([
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "prisma/seed.ts",
    ]);
    writeFileSync(join(dir, "seeded"), "synthetic");
  }
  await run(
    [
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "scripts/create-app-role.ts",
    ],
    apiDir,
    { DATABASE_URL: env.DATABASE_ADMIN_URL },
  );
  await run([
    req.resolve("ts-node/dist/bin.js"),
    "--transpile-only",
    "scripts/enable-rls.ts",
  ]);
  await run([join(root, "packages/collab-store/migrate.cjs")], root);
  const pool = new (require("../packages/collab-store/node_modules/pg").Pool)({
    connectionString: env.DATABASE_ADMIN_URL,
  });
  const users = (
    await pool.query(
      "SELECT id,email FROM sys_user WHERE email IN ('owner@acme.dev','member@acme.dev','admin@acme.dev','owner@globex.dev')",
    )
  ).rows;
  const orgs = (
    await pool.query(
      "SELECT id,slug FROM org_organization WHERE slug IN ('acme','globex')",
    )
  ).rows;
  const org = orgs.find((x) => x.slug === "acme").id,
    otherOrg = orgs.find((x) => x.slug === "globex").id;
  const project = (
    await pool.query(
      "SELECT id FROM prj_project WHERE organization_id=$1 AND status<>'ARCHIVED' ORDER BY created_at LIMIT 1",
      [org],
    )
  ).rows[0].id;
  const config = {
    ...env,
    TEST_ORG: org,
    TEST_OTHER_ORG: otherOrg,
    TEST_OWNER: users.find((u) => u.email === "owner@acme.dev").id,
    TEST_MEMBER: users.find((u) => u.email === "member@acme.dev").id,
    TEST_ADMIN: users.find((u) => u.email === "admin@acme.dev").id,
    TEST_OTHER_USER: users.find((u) => u.email === "owner@globex.dev").id,
    TEST_PROJECT: project,
    COLLAB_TEST_DATABASE_URL: env.DATABASE_URL,
  };
  // Only explicit synthetic settings, never the host environment.
  const keys = [
    "DATABASE_URL",
    "DATABASE_ADMIN_URL",
    "JWT_SECRET",
    "APP_PORT",
    "COLLAB_PORT",
    "COLLAB_WS_URL",
    "WEB_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_WS_URL",
    "REDIS_URL",
    "BILLING_MODE",
    "EMAIL_PROVIDER",
    "UPLOAD_ROOT",
    "TEST_ORG",
    "TEST_OTHER_ORG",
    "TEST_OWNER",
    "TEST_MEMBER",
    "TEST_ADMIN",
    "TEST_OTHER_USER",
    "TEST_PROJECT",
    "COLLAB_TEST_DATABASE_URL",
  ];
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify(
      Object.fromEntries(keys.map((k) => [k, config[k]])),
      null,
      2,
    ),
  );
  await pool.end();
  for (const [cwd, args] of [
    [
      apiDir,
      [req.resolve("ts-node/dist/bin.js"), "--transpile-only", "src/main.ts"],
    ],
    [join(root, "apps/collab"), ["src/server.cjs"]],
    [
      join(root, "apps/web"),
      [
        createRequire(join(root, "apps/web/package.json")).resolve(
          "next/dist/bin/next",
        ),
        "dev",
        "-p",
        "43120",
      ],
    ],
  ])
    children.push(
      spawn(process.execPath, args, {
        cwd,
        env,
        stdio: "inherit",
        windowsHide: true,
      }),
    );
  console.log(
    `CollabSpace local web: http://localhost:43120/projects/${project}/documents`,
  );
}
async function stop(code = 0) {
  for (const p of children) p.kill();
  if (pg) await pg.stop();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
main().catch(async (e) => {
  console.error(e);
  await stop(1);
});
