const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("../../packages/collab-store/node_modules/pg");
const config = require("./config.cjs");
async function fixture(browser, request) {
  const api = config.NEXT_PUBLIC_API_URL,
    org = config.TEST_ORG;
  const response = await request.post(`${api}/auth/login`, {
    data: { email: config.TEST_OWNER_EMAIL, password: config.TEST_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const token = (await response.json()).accessToken;
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": org,
  };
  const created = await request.post(`${api}/documents`, {
    headers,
    data: {
      projectId: config.TEST_PROJECT,
      title: "Reliability " + randomUUID().slice(0, 8),
    },
  });
  expect(created.ok()).toBeTruthy();
  const doc = await created.json();
  const context = await browser.newContext();
  await context.addInitScript(
    ({ token, org }) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("current_org_id", org);
    },
    { token, org },
  );
  const path = `${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${doc.id}`;
  return { context, path, doc };
}
test("lost durable ACK reconnects with the same update ID and never duplicates the committed edit", async ({
  browser,
  request,
}) => {
  const { context, path, doc } = await fixture(browser, request);
  let enabled = false,
    droppedId = null,
    droppedSeq = null,
    replaySeq = null;
  await context.routeWebSocket("**/collab", (route) => {
    const upstream = route.connectToServer();
    route.onMessage((message) => upstream.send(message));
    upstream.onMessage((message) => {
      const m = JSON.parse(message.toString());
      if (enabled && !droppedId && m.type === "ack") {
        droppedId = m.updateId;
        droppedSeq = m.seq;
        return;
      }
      if (m.type === "ack" && m.updateId === droppedId) replaySeq = m.seq;
      route.send(message);
    });
  });
  const page = await context.newPage();
  try {
    await page.goto(path);
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible();
    enabled = true;
    await page
      .getByRole("textbox", { name: "协作文档正文" })
      .fill("ACK replay remains one committed edit");
    await expect.poll(() => droppedId).not.toBeNull();
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect.poll(() => replaySeq).toBe(droppedSeq);
    if (config.DATABASE_ADMIN_URL) {
      const pool = new Pool({ connectionString: config.DATABASE_ADMIN_URL });
      try {
        const rows = await pool.query(
          "SELECT count(*)::int AS n FROM collab_update WHERE document_id=$1 AND update_id=$2",
          [doc.id, droppedId],
        );
        expect(rows.rows[0].n).toBe(1);
      } finally {
        await pool.end();
      }
    }
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "协作文档正文" }),
    ).toHaveText("ACK replay remains one committed edit");
  } finally {
    await context.close();
  }
});
test("offline keystrokes survive closing the page and replay after reconnect without flooding", async ({
  browser,
  request,
}) => {
  const seconds = Number(process.env.OFFLINE_HOLD_SECONDS || 0);
  test.setTimeout((seconds + 420) * 1000);
  const { context, path } = await fixture(browser, request);
  let page = await context.newPage();
  const pendingText = "offline-" + "abcdefghijklmnop".repeat(8);
  try {
    await page.goto(path);
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible();
    await context.setOffline(true);
    const editor = page.getByRole("textbox", { name: "协作文档正文" });
    await editor.click();
    await page.keyboard.type(pendingText);
    await expect(
      page.getByText("已保存到此设备 · 离线", { exact: false }),
    ).toBeVisible();
    if (seconds) {
      console.log(`Holding disconnected editor for ${seconds}s`);
      await page.waitForTimeout(seconds * 1000);
    }
    await context.route("**/documents/*/session-ticket", (route) =>
      route.abort(),
    );
    await page.close();
    await context.setOffline(false);
    page = await context.newPage();
    await page.goto(path);
    await expect(
      page.getByRole("textbox", { name: "协作文档正文" }),
    ).toContainText(pendingText);
    const replayStarted = Date.now();
    let replayed = 0, acknowledged = 0;
    page.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => {
        try { if (JSON.parse(String(payload)).type === "update") replayed++; } catch {}
      });
      socket.on("framereceived", ({ payload }) => {
        try { if (JSON.parse(String(payload)).type === "ack") acknowledged++; } catch {}
      });
    });
    await context.unroute("**/documents/*/session-ticket");
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible({ timeout: pendingText.length * 2000 + 30000 });
    console.log(JSON.stringify({ offlineReplayMs: Date.now() - replayStarted, replayed, acknowledged }));
    expect(replayed).toBeGreaterThan(0);
    expect(acknowledged).toBe(replayed);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "协作文档正文" }),
    ).toHaveText(pendingText);
  } finally {
    await context.close();
  }
});
