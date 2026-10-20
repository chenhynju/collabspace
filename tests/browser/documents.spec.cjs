const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const config = require("./config.cjs");
test("three users collaborate, reconnect offline edits, comment, version and recover a private copy", async ({
  browser,
  request,
}) => {
  const api = config.NEXT_PUBLIC_API_URL,
    web = config.WEB_URL,
    org = config.TEST_ORG;
  async function login(email) {
    const r = await request.post(`${api}/auth/login`, {
      data: { email, password: config.TEST_PASSWORD },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    const d = await r.json();
    return d.accessToken;
  }
  const token = await login(config.TEST_OWNER_EMAIL),
    memberToken = await login(config.TEST_MEMBER_EMAIL),
    adminToken = await login(config.TEST_ADMIN_EMAIL);
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": org,
  };
  const created = await request.post(`${api}/documents`, {
    headers,
    data: {
      projectId: config.TEST_PROJECT,
      title: "Remote delivery " + randomUUID().slice(0, 8),
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const doc = await created.json();
  for (const userId of [config.TEST_MEMBER, config.TEST_ADMIN])
    expect(
      (
        await request.put(`${api}/documents/${doc.id}/grants`, {
          headers,
          data: { userId, role: "EDITOR" },
        })
      ).ok(),
    ).toBeTruthy();
  const contexts = [];
  const errors = [];
  async function client(t) {
    const c = await browser.newContext();
    contexts.push(c);
    await c.addInitScript(
      ({ token, org }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("current_org_id", org);
      },
      { token: t, org },
    );
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${web}/projects/${config.TEST_PROJECT}/documents/${doc.id}`);
    await expect(
      p.getByRole("textbox", { name: "协作文档正文" }),
    ).toBeVisible();
    await expect(p.getByText("已保存到服务器", { exact: false })).toBeVisible();
    return { c, p, editor: p.getByRole("textbox", { name: "协作文档正文" }) };
  }
  try {
    const a = await client(token),
      b = await client(memberToken),
      c = await client(adminToken);
    await a.editor.click();
    await a.p.keyboard.type("Release requirements");
    await expect(b.editor).toContainText("Release requirements");
    await expect(c.editor).toContainText("Release requirements");
    await Promise.all([
      b.editor.press("End").then(() => b.p.keyboard.insertText(" / API ready")),
      c.editor.press("End").then(() => c.p.keyboard.insertText(" / UI ready")),
    ]);
    await expect(a.editor).toContainText("API ready");
    await expect(a.editor).toContainText("UI ready");
    await b.c.setOffline(true);
    await b.editor.press("End");
    await b.p.keyboard.type(" / offline review");
    await expect(
      b.p.getByText("已保存到此设备 · 离线", { exact: false }),
    ).toBeVisible();
    await a.editor.press("End");
    await a.p.keyboard.type(" / owner approved");
    await b.c.setOffline(false);
    await expect(a.editor).toContainText("offline review");
    await expect(b.editor).toContainText("owner approved");
    await expect(
      b.p.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible();
    await a.editor.press("Control+Home");
    await a.editor.press("Control+Shift+End");
    await a.p
      .getByRole("textbox", { name: "评论内容" })
      .fill("Confirm the acceptance checklist");
    await a.p
      .getByRole("button", { name: "评论选中内容", exact: true })
      .click();
    await expect(
      b.p.getByText("Confirm the acceptance checklist", { exact: true }),
    ).toBeVisible();
    await b.p.getByRole("button", { name: "标记解决" }).click();
    await expect(a.p.getByText("已解决", { exact: false })).toBeVisible();
    await a.p.getByRole("button", { name: "历史版本", exact: true }).click();
    await a.p
      .getByRole("textbox", { name: "版本名称" })
      .fill("Client approved v1");
    await expect(a.p.getByRole("button", { name: "创建版本" })).toBeEnabled();
    await a.p.getByRole("button", { name: "创建版本" }).click();
    await expect(
      a.p.getByText("Client approved v1", { exact: true }),
    ).toBeVisible();
    await a.p.getByRole("button", { name: "只读预览" }).click();
    await expect(a.p.getByRole("dialog")).toContainText("Release requirements");
    await expect(a.p.getByLabel("历史版本只读预览")).not.toHaveAttribute(
      "contenteditable",
      "true",
    );
    await a.p.getByRole("button", { name: "关闭预览" }).click();
    await a.p.screenshot({
      path: "evidence/collaboration/editor.png",
      fullPage: true,
    });
    await a.p.getByRole("button", { name: "恢复为副本" }).click();
    await expect(a.p).not.toHaveURL(new RegExp(`${doc.id}$`));
    await expect(
      a.p.getByRole("textbox", { name: "协作文档正文" }),
    ).toContainText("Release requirements");
    const copyId = a.p.url().split("/").pop();
    const denied = await request.get(`${api}/documents/${copyId}`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
        "x-organization-id": org,
      },
    });
    expect(denied.status()).toBe(404);
    // Revoke an already-connected editor; offline draft must not be uploaded.
    await b.c.setOffline(true);
    await b.editor.press("End");
    await b.p.keyboard.type(" revoked draft");
    await request.put(`${api}/documents/${doc.id}/grants`, {
      headers,
      data: { userId: config.TEST_MEMBER, role: "REMOVE" },
    });
    await b.c.setOffline(false);
    await expect(
      b.p.getByText("权限已撤销，未同步草稿可导出", { exact: false }),
    ).toBeVisible();
    await expect(c.editor).not.toContainText("revoked draft");
    expect(errors).toEqual([]);
  } finally {
    for (const c of contexts) await c.close();
  }
});
