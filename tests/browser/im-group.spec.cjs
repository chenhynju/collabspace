const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const config = require("./config.cjs");

test("three IM accounts exchange group messages in realtime and keep history", async ({
  browser,
  request,
}) => {
  test.setTimeout(300000);
  const api = config.NEXT_PUBLIC_API_URL;
  const accounts = [
    { email: config.TEST_OWNER_EMAIL, userId: config.TEST_OWNER, label: "owner" },
    { email: config.TEST_MEMBER_EMAIL, userId: config.TEST_MEMBER, label: "member" },
    { email: config.TEST_ADMIN_EMAIL, userId: config.TEST_ADMIN, label: "admin" },
  ];
  const tokens = {};
  for (const account of accounts) {
    const login = await request.post(api + "/auth/login", {
      data: { email: account.email, password: config.TEST_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    tokens[account.email] = (await login.json()).accessToken;
  }
  const headers = {
    Authorization: "Bearer " + tokens[config.TEST_OWNER_EMAIL],
    "x-organization-id": config.TEST_ORG,
  };
  const title = "三人群聊验收-" + randomUUID().slice(0, 6);
  const created = await request.post(api + "/conversations/group", {
    headers,
    data: { title, memberIds: [config.TEST_MEMBER, config.TEST_ADMIN] },
  });
  expect(created.ok()).toBeTruthy();
  const conversationId = (await created.json()).id;

  const contexts = [];
  async function open(account) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contexts.push(context);
    await context.addInitScript(
      ({ token, org }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("current_org_id", org);
      },
      { token: tokens[account.email], org: config.TEST_ORG },
    );
    const page = await context.newPage();
    await page.goto(config.WEB_URL + "/im?c=" + conversationId, { timeout: 120000 });
    await expect(page.getByPlaceholder("输入消息...")).toBeVisible({ timeout: 60000 });
    return page;
  }
  const pages = {};
  const bubble = (page, text) => page.locator(".whitespace-pre-wrap").filter({ hasText: text });
  try {
    for (const account of accounts) pages[account.label] = await open(account);
    const prefix = "im3-" + randomUUID().slice(0, 6);
    const sent = [];
    for (const account of accounts) {
      const text = prefix + "-" + account.label;
      sent.push(text);
      const page = pages[account.label];
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/conversations/" + conversationId + "/messages") &&
          r.request().method() === "POST",
      );
      await page.getByPlaceholder("输入消息...").fill(text);
      await page.getByRole("button", { name: "发送", exact: true }).click();
      expect((await response).ok()).toBeTruthy();
      for (const name of ["owner", "member", "admin"])
        await expect(bubble(pages[name], text)).toHaveCount(1, { timeout: 30000 });
    }
    const history = await request.get(
      api + "/conversations/" + conversationId + "/messages?limit=50",
      { headers },
    );
    expect(history.ok()).toBeTruthy();
    const rows = (await history.json()).filter((m) => m.content.startsWith(prefix));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((m) => m.id)).size).toBe(3);
    await pages.member.reload();
    await expect(pages.member.getByPlaceholder("输入消息...")).toBeVisible({ timeout: 60000 });
    for (const text of sent) await expect(bubble(pages.member, text)).toHaveCount(1);
    await pages.owner.screenshot({
      path: "evidence/collaboration/im-group-owner.png",
      fullPage: true,
    });
  } finally {
    for (const context of contexts) await context.close();
  }
});
