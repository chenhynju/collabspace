const { readFileSync } = require("node:fs");
const config = JSON.parse(
  readFileSync(
    process.env.COLLAB_BROWSER_CONFIG || ".test-runs/collab-local/config.json",
    "utf8",
  ),
);
const local = ["localhost", "127.0.0.1", "::1"].includes(
  new URL(config.WEB_URL).hostname,
);
if (!local) {
  if (
    new URL(config.WEB_URL).protocol !== "https:" ||
    new URL(config.NEXT_PUBLIC_API_URL).protocol !== "https:"
  )
    throw Error("Online acceptance requires HTTPS");
  for (const key of [
    "TEST_PASSWORD",
    "TEST_OWNER_EMAIL",
    "TEST_MEMBER_EMAIL",
    "TEST_ADMIN_EMAIL",
    "TEST_ORG",
    "TEST_PROJECT",
    "TEST_MEMBER",
    "TEST_ADMIN",
  ])
    if (!config[key])
      throw Error(`Missing online acceptance configuration: ${key}`);
  if (config.DATABASE_ADMIN_URL)
    throw Error(
      "Online browser acceptance must not use an administrative database connection",
    );
}
module.exports = {
  TEST_PASSWORD: "Passw0rd!",
  TEST_OWNER_EMAIL: "owner@acme.dev",
  TEST_MEMBER_EMAIL: "member@acme.dev",
  TEST_ADMIN_EMAIL: "admin@acme.dev",
  ...config,
};
