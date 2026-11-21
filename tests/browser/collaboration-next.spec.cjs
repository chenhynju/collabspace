const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const c = require("./config.cjs");

test.skip(
  process.env.COLLABORATION_NEXT_ONLINE_TEST !== "1",
  "Explicit synthetic online acceptance required",
);

async function login(request, email) {
  const response = await request.post(c.NEXT_PUBLIC_API_URL + "/auth/login", {
    data: { email, password: c.TEST_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).accessToken;
}

function headers(token) {
  return { Authorization: "Bearer " + token, "x-organization-id": c.TEST_ORG };
}

async function pageFor(browser, token) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(
    ({ token, org }) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("current_org_id", org);
    },
    { token, org: c.TEST_ORG },
  );
  const page = await context.newPage();
  return { context, page };
}

async function project(request, token) {
  const response = await request.get(c.NEXT_PUBLIC_API_URL + "/projects", {
    headers: headers(token),
  });
  expect(response.ok()).toBeTruthy();
  const rows = await response.json();
  const selected = rows.find((row) => row.id === c.TEST_PROJECT);
  expect(selected).toBeTruthy();
  return selected;
}

test("unfinished entries stay hidden and global search enforces document grants", async ({
  browser,
  request,
}) => {
  const token = await login(request, c.TEST_OWNER_EMAIL);
  const peer = await login(request, c.TEST_MEMBER_EMAIL);
  const target = await project(request, token);
  const title = "全局搜索验收-" + randomUUID().slice(0, 8);
  const created = await request.post(c.NEXT_PUBLIC_API_URL + "/documents", {
    headers: headers(token),
    data: { projectId: target.id, title, kind: "DOCUMENT" },
  });
  expect(created.ok()).toBeTruthy();
  const document = await created.json();
  const { context, page } = await pageFor(browser, token);
  try {
    const ownerSearch = await request.get(
      c.NEXT_PUBLIC_API_URL + "/search?q=" + encodeURIComponent(title),
      { headers: headers(token) },
    );
    expect(ownerSearch.ok()).toBeTruthy();
    expect((await ownerSearch.json()).results.some((row) => row.id === document.id)).toBeTruthy();
    const peerSearch = await request.get(
      c.NEXT_PUBLIC_API_URL + "/search?q=" + encodeURIComponent(title),
      { headers: headers(peer) },
    );
    expect(peerSearch.ok()).toBeTruthy();
    expect((await peerSearch.json()).results.some((row) => row.id === document.id)).toBeFalsy();

    await page.goto(c.WEB_URL + "/projects/" + target.id, { timeout: 120000 });
    await expect(page.getByRole("heading", { name: target.name, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "视频会议", exact: true })).toHaveCount(0);
    await page.goto(c.WEB_URL + "/settings", { timeout: 120000 });
    await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /套餐与账单/ })).toHaveCount(0);
    await page.goto(c.WEB_URL + "/system/configs", { timeout: 120000 });
    await expect(page.getByRole("button", { name: "打开可动3D实验室" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "协作助手的静态形象" })).toBeVisible();

    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await page.getByRole("button", { name: "打开全局搜索" }).click();
    const dialog = page.getByRole("dialog", { name: "全局搜索" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("搜索项目、文档、任务和附件").fill(title);
    await expect(dialog.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await dialog.getByLabel("搜索项目、文档、任务和附件").press("Enter");
    await page.waitForURL(/\/search\?q=/);
    await expect(page.getByRole("heading", { name: "全局搜索", exact: true })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await page.waitForURL(new RegExp("/documents/" + document.id + "$"));
    await page.screenshot({
      path: "evidence/collaboration/collaboration-next-2026-11-21/global-search.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

test("AI assistant creates Office, uploads a real file and draws editable canvas shapes", async ({
  browser,
  request,
}) => {
  test.setTimeout(360000);
  const token = await login(request, c.TEST_OWNER_EMAIL);
  const target = await project(request, token);
  const suffix = randomUUID().slice(0, 8);
  const officeTitle = "AI验收-Office-" + suffix;
  const uploadName = "AI验收-附件-" + suffix + ".txt";
  const { context, page } = await pageFor(browser, token);
  try {
    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await page.getByRole("button", { name: "打开 AI 工作助理" }).click();
    let dock = page.getByRole("dialog", { name: "AI 工作助理" });
    await dock.getByLabel("给 AI 助理的消息").fill(`新建 Word「${officeTitle}」到项目「${target.name}」`);
    await dock.getByRole("button", { name: "发送", exact: true }).click();
    await expect(dock.getByText(`新建 Word「${officeTitle}」`, { exact: true })).toBeVisible();
    const officeResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/api/v1/office/create"),
      { timeout: 90000 },
    );
    await dock.getByRole("button", { name: "确认执行" }).last().click();
    expect((await officeResponse).ok()).toBeTruthy();
    await page.waitForURL(/\/office\/[0-9a-f-]+$/);
    await expect(page.locator('[data-office-ready="true"]')).toBeVisible({ timeout: 180000 });
    await page.screenshot({
      path: "evidence/collaboration/collaboration-next-2026-11-21/ai-office.png",
      fullPage: true,
    });
    const officeId = page.url().split("/").pop();
    const state = await request.get(c.NEXT_PUBLIC_API_URL + "/office/" + officeId + "/state", {
      headers: headers(token),
    });
    expect(state.ok()).toBeTruthy();
    expect((await state.json()).title).toContain(officeTitle);

    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await page.getByRole("button", { name: "打开 AI 工作助理" }).click();
    dock = page.getByRole("dialog", { name: "AI 工作助理" });
    await dock.getByLabel("给 AI 助理的消息").fill(`上传文件到项目「${target.name}」`);
    await dock.getByRole("button", { name: "发送", exact: true }).click();
    await dock.getByLabel("选择要上传的本地文件").setInputFiles({
      name: uploadName,
      mimeType: "text/plain",
      buffer: Buffer.from("CollabSpace AI upload acceptance\n" + suffix),
    });
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/api/v1/files/upload"),
      { timeout: 60000 },
    );
    await dock.getByRole("button", { name: "确认执行" }).last().click();
    expect((await uploadResponse).ok()).toBeTruthy();
    await expect(dock.getByRole("button", { name: "已执行" }).last()).toBeVisible();
    const files = await request.get(c.NEXT_PUBLIC_API_URL + "/files?projectId=" + target.id, {
      headers: headers(token),
    });
    expect(files.ok()).toBeTruthy();
    expect((await files.json()).some((file) => file.name === uploadName)).toBeTruthy();

    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await page.getByRole("button", { name: "打开 AI 工作助理" }).click();
    dock = page.getByRole("dialog", { name: "AI 工作助理" });
    await dock
      .getByLabel("给 AI 助理的消息")
      .fill(`给项目「${target.name}」画一个三步审批流程图：提交、审批、发布`);
    await dock.getByRole("button", { name: "发送", exact: true }).click();
    await expect(dock.getByText(/生成流程图/).last()).toBeVisible();
    const drawResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/api/v1/documents/agent/draw"),
      { timeout: 120000 },
    );
    await dock.getByRole("button", { name: "确认执行" }).last().click();
    const draw = await drawResponse;
    expect(draw.ok()).toBeTruthy();
    expect((await draw.json()).canvas).toBe(true);
    await page.waitForURL(/\/projects\/[^/]+\/documents\/[^/]+$/, { timeout: 120000 });
    await expect(page.getByTestId("whiteboard-canvas")).toBeVisible({ timeout: 120000 });
    expect(await page.getByTestId("board-shape").count()).toBeGreaterThanOrEqual(3);
    expect(await page.getByTestId("bound-connector").count()).toBeGreaterThanOrEqual(2);
    await page.screenshot({
      path: "evidence/collaboration/collaboration-next-2026-11-21/ai-office-upload-canvas.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
