const { Pool } = require("pg");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
(async () => {
  if (!process.env.DATABASE_ADMIN_URL)
    throw new Error("DATABASE_ADMIN_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(readFileSync(join(__dirname, "schema.sql"), "utf8"));
    await c.query(readFileSync(join(__dirname, "office.sql"), "utf8"));
    await c.query("COMMIT");
    console.log("CollabSpace additive migration applied");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
