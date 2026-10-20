// Fresh, dedicated CollabSpace database only. Never upgrade an existing schema.
const { Pool } = require("/repo/packages/collab-store/node_modules/pg");
const { readFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const req = createRequire("/repo/apps/api/package.json");
function run(args, env = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd: "/repo/apps/api",
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (r.status !== 0) throw Error("Initialization subprocess failed");
}
(async () => {
  if (!/^[a-f0-9]{64}$/.test(process.env.APP_DB_PASSWORD || ""))
    throw Error("Expected generated database password");
  if ((process.env.SEED_PASSWORD || "").length < 24)
    throw Error("Private demo password required");
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  try {
    const count = (
      await pool.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows[0].n;
    if (count !== 0) throw Error("Refusing to initialize a non-empty database");
    await pool.query(
      "BEGIN;\n" +
        readFileSync("/repo/deploy/collabspace/initial-schema.sql", "utf8") +
        "\nCOMMIT;",
    );
    run(
      [
        req.resolve("ts-node/dist/bin.js"),
        "--transpile-only",
        "prisma/seed.ts",
      ],
      { DATABASE_URL: process.env.DATABASE_ADMIN_URL },
    );
    await pool.query(
      `CREATE ROLE collabspace_app LOGIN PASSWORD '${process.env.APP_DB_PASSWORD}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`,
    );
    await pool.query(
      "GRANT USAGE ON SCHEMA public TO collabspace_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO collabspace_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO collabspace_app",
    );
    run([
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "scripts/enable-rls.ts",
    ]);
    run([
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "scripts/seed-im-menus.ts",
    ]);
    run([
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "scripts/seed-system-menus.ts",
    ]);
    run([
      req.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      "scripts/grant-monitor-privs.ts",
    ]);
    await pool.query(
      readFileSync("/repo/packages/collab-store/schema.sql", "utf8"),
    );
    // Docker volume is shared with the explicitly assigned non-root runtime user.
    const ownership = spawnSync("chown", [
      "-R",
      "10001:10001",
      "/repo/apps/api/.uploads",
    ]);
    if (ownership.status !== 0)
      throw Error("Upload ownership initialization failed");
    console.log(
      "Dedicated CollabSpace database initialized; runtime RLS role enabled",
    );
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
