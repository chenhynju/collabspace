const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const config = require("./config.cjs");

test("same-user tabs deduplicate presence; disconnect expires and deleted-source comments remain visible", async ({
  browser,
  request,
}) => {
  const org = config.TEST_ORG,
    api = config.NEXT_PUBLIC_API_URL;
  async function login(email) {
    const response = await request.post(`${api}/auth/login`, {
      data: { email, password: config.TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    const token = (await response.json()).accessToken;
    const headers = {
      Authorization: `Bearer ${token}`,
      "x-organization-id": org,
    };
    const me = await request.get(`${api}/users/me`, { headers });
    return { token, headers, name: (await me.json()).name };
  }
  const owner = await login(config.TEST_OWNER_EMAIL),
    member = await login(config.TEST_MEMBER_EMAIL);
  const response = await request.post(`${api}/documents`, {
    headers: owner.headers,
    data: { projectId: config.TEST_PROJECT, title: `Presence ${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const doc = await response.json();
  expect(
    (
      await request.put(`${api}/documents/${doc.id}/grants`, {
        headers: owner.headers,
        data: { userId: config.TEST_MEMBER, role: "EDITOR" },
      })
    ).ok(),
  ).toBeTruthy();
  const contexts = [];
  async function context(user) {
    const c = await browser.newContext();
    contexts.push(c);
    await c.addInitScript(
      ({ token, org }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("current_org_id", org);
      },
      { token: user.token, org },
    );
    return c;
  }
  async function open(c) {
    const page = await c.newPage();
    await page.goto(
      `${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${doc.id}`,
    );
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible();
    return page;
  }
  try {
    const a = await context(owner),
      b = await context(member);
    const page = await open(a);
    await open(a);
    const other = await open(b);
    const online = page.getByLabel("在线成员");
    await expect(online).toContainText(member.name);
    expect(
      (await online.textContent()).split("、").filter((n) => n === owner.name),
    ).toHaveLength(1);
    await b.setOffline(true);
    await expect(online).toHaveText(owner.name, { timeout: 30000 });
    const editor = page.getByRole("textbox", { name: "协作文档正文" });
    await editor.fill("Original quoted passage");
    await expect(page.getByText('已保存到服务器',{exact:false})).toBeVisible();
    await editor.press("Control+Home");
    await editor.press("Control+Shift+End");
    await expect(page.getByRole('button',{name:'评论选中内容',exact:true})).toBeVisible();
    await page
      .getByRole("textbox", { name: "评论内容" })
      .fill("Keep this discussion after deleting the source");
    await page
      .getByRole("button", { name: "评论选中内容", exact: true })
      .click({timeout:20000});
    await expect(
      page.getByText("Keep this discussion after deleting the source", {
        exact: true,
      }),
    ).toBeVisible();
    await editor.fill("");
    await expect(page.getByText(/^原文已删除 ·/)).toBeVisible();
    await expect(
      page.getByText("Keep this discussion after deleting the source", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("已保存到服务器", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^原文已删除 ·/)).toBeVisible();
  } finally {
    for (const c of contexts) await c.close();
  }
});
