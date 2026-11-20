const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const c = require("./config.cjs");

async function login(request, email) {
  const response = await request.post(c.NEXT_PUBLIC_API_URL + "/auth/login", {
    data: { email, password: c.TEST_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).accessToken;
}

async function pageFor(browser, token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    ({ token, org }) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("current_org_id", org);
    },
    { token, org: c.TEST_ORG },
  );
  return context.newPage();
}

function headers(token) {
  return { Authorization: "Bearer " + token, "x-organization-id": c.TEST_ORG };
}

/** 回收本套件历史运行留下的项目，避免套餐项目数上限污染后续验收。 */
async function cleanupTestProjects(request, token) {
  const response = await request.get(c.NEXT_PUBLIC_API_URL + "/projects", {
    headers: headers(token),
  });
  if (!response.ok()) return;
  const projects = await response.json();
  for (const project of projects) {
    if (!/^(Agent项目-|Smoke 项目|Smoke项目|UI项目-|UI 项目)/.test(project.name)) continue;
    if (project.status === "DRAFT") {
      await request.delete(c.NEXT_PUBLIC_API_URL + "/projects/" + project.id, {
        headers: headers(token),
      });
    } else if (project.status === "ACTIVE" || project.status === "DELIVERED") {
      await request.post(c.NEXT_PUBLIC_API_URL + "/projects/" + project.id + "/archive", {
        headers: headers(token),
      });
    }
  }
}

function waitForWrite(page, method, pathPart) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname.startsWith("/api/v1" + pathPart),
    { timeout: 60000 },
  );
}

test("Shell: no persistent left rail, drawer navigation, unified project space CRUD", async ({
  browser,
  request,
}) => {
  test.setTimeout(240000);
  const token = await login(request, c.TEST_OWNER_EMAIL);
  await cleanupTestProjects(request, token);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(
    ({ token, org }) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("current_org_id", org);
    },
    { token, org: c.TEST_ORG },
  );
  const page = await context.newPage();
  const suffix = randomUUID().slice(0, 6);
  const workspaceName = "UI空间-" + suffix;
  const projectName = "UI项目-" + suffix;
  let workspaceId = "";
  try {
    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await expect(page.getByRole("heading", { name: /你好/ })).toBeVisible();
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(page.locator("nav").first()).toBeVisible();
    await expect(
      page.locator("nav").first().getByRole("link", { name: "协作空间", exact: true }),
    ).toBeVisible();

    const drawerButton = page.getByRole("button", { name: "打开导航", exact: true });
    await drawerButton.click();
    const drawer = page.getByRole("dialog", { name: "工作台菜单" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /^项目空间/ })).toBeVisible();
    // 工作区不再单独占一条导航；旧地址仍会回到项目空间的工作区面板。
    await expect(drawer.getByRole("link", { name: "工作区", exact: true })).toHaveCount(0);
    // 管理类入口收进设置，不占据主导航。
    await expect(drawer.getByRole("link", { name: "成员", exact: true })).toHaveCount(0);
    await expect(drawer.getByRole("link", { name: "设置与组织", exact: false })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(drawerButton).toHaveAttribute("aria-expanded", "false");

    await page.goto(c.WEB_URL + "/settings", { timeout: 120000 });
    await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /成员/ }).first()).toBeVisible();

    await page.goto(c.WEB_URL + "/projects", { timeout: 120000 });
    await expect(page.getByRole("heading", { name: "项目空间", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "管理工作区", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "管理工作区" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("工作区名称").fill(workspaceName);
    await panel.getByRole("button", { name: "创建工作区", exact: true }).click();
    await expect(panel.getByText(workspaceName, { exact: true })).toBeVisible();
    const workspaces = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/workspaces", { headers: headers(token) })
    ).json();
    workspaceId = workspaces.find((workspace) => workspace.name === workspaceName)?.id || "";
    expect(workspaceId).toBeTruthy();
    await panel.getByRole("button", { name: "关闭工作区管理" }).click();

    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建项目" });
    await dialog.getByLabel("所属工作区").selectOption(workspaceId);
    await dialog.getByLabel("项目名称").fill(projectName);
    await dialog.getByLabel("描述").fill("浏览器验收创建的项目");
    await dialog.getByRole("button", { name: "创建（草稿）", exact: true }).click();
    await expect(page.getByRole("link", { name: projectName, exact: true })).toBeVisible();
    const card = page.locator("article").filter({ hasText: projectName });
    await expect(card.getByText("草稿", { exact: true })).toBeVisible();

    page.once("dialog", (confirm) => confirm.accept());
    await card.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByRole("link", { name: projectName, exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "管理工作区", exact: true }).click();
    const panelAgain = page.getByRole("dialog", { name: "管理工作区" });
    page.once("dialog", (confirm) => confirm.accept());
    await panelAgain.getByRole("button", { name: `删除工作区 ${workspaceName}` }).click();
    await expect(panelAgain.getByText(workspaceName, { exact: true })).toHaveCount(0);
    const after = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/workspaces", { headers: headers(token) })
    ).json();
    expect(after.some((workspace) => workspace.id === workspaceId)).toBeFalsy();
  } finally {
    await context.close();
  }
});

test("AI agent: real read, confirmed writes for workspace/project/task, and completion", async ({
  browser,
  request,
}) => {
  test.setTimeout(300000);
  const token = await login(request, c.TEST_OWNER_EMAIL);
  await cleanupTestProjects(request, token);
  const page = await pageFor(browser, token);
  const suffix = randomUUID().slice(0, 6);
  const workspaceName = "Agent空间-" + suffix;
  const projectName = "Agent项目-" + suffix;
  const taskTitle = "验收任务-" + suffix;
  let createdProjectId = "";
  try {
    await page.goto(c.WEB_URL + "/projects", { timeout: 120000 });
    await page.getByRole("button", { name: "打开 AI 工作助理" }).click();
    const dock = page.getByRole("dialog", { name: "AI 工作助理" });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("button", { name: "语音输入" })).toBeVisible();

    const composer = dock.getByLabel("给 AI 助理的消息");
    await composer.fill("列出所有项目");
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(/个可访问项目|还没有可访问项目/)).toBeVisible();
    await expect(dock.getByText("本地规则规划", { exact: true })).toBeVisible();

    await composer.fill(`新建工作区「${workspaceName}」`);
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(
      dock.getByText(`新建工作区「${workspaceName}」`, { exact: true }).last(),
    ).toBeVisible();
    const [workspaceResponse] = await Promise.all([
      waitForWrite(page, "POST", "/workspaces"),
      dock.getByRole("button", { name: "确认执行" }).last().click(),
    ]);
    expect(workspaceResponse.ok()).toBeTruthy();
    const workspaces = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/workspaces", { headers: headers(token) })
    ).json();
    const workspace = workspaces.find((row) => row.name === workspaceName);
    expect(workspace).toBeTruthy();

    await composer.fill(`新建项目「${projectName}」到工作区「${workspaceName}」`);
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(`新建项目「${projectName}」`, { exact: true })).toBeVisible();
    const [projectResponse] = await Promise.all([
      waitForWrite(page, "POST", "/projects"),
      dock.getByRole("button", { name: "确认执行" }).last().click(),
    ]);
    expect(projectResponse.ok()).toBeTruthy();
    await expect(page.getByRole("link", { name: projectName, exact: true })).toBeVisible({
      timeout: 60000,
    });
    const projects = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/projects", { headers: headers(token) })
    ).json();
    const project = projects.find((row) => row.name === projectName);
    expect(project).toBeTruthy();
    createdProjectId = project.id;

    await composer.fill(`给项目「${projectName}」添加任务「${taskTitle}」`);
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(`新建任务「${taskTitle}」`, { exact: true })).toBeVisible();
    const [taskResponse] = await Promise.all([
      waitForWrite(page, "POST", "/tasks"),
      dock.getByRole("button", { name: "确认执行" }).last().click(),
    ]);
    expect(taskResponse.ok()).toBeTruthy();

    await composer.fill(`把任务「${taskTitle}」标记完成`);
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(`更新任务「${taskTitle}」`, { exact: true })).toBeVisible();
    const [updateResponse] = await Promise.all([
      waitForWrite(page, "PATCH", "/tasks"),
      dock.getByRole("button", { name: "确认执行" }).last().click(),
    ]);
    expect(updateResponse.ok()).toBeTruthy();
    await expect(dock.getByRole("button", { name: "已执行" }).last()).toBeVisible();

    const tasks = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/tasks?projectId=" + project.id, {
        headers: headers(token),
      })
    ).json();
    expect(tasks.find((task) => task.title === taskTitle)?.status).toBe("DONE");

    const docTitle = "验收文档-" + suffix;
    await composer.fill(`新建文档「${docTitle}」到项目「${projectName}」`);
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(`新建文档「${docTitle}」`, { exact: true })).toBeVisible();
    const [documentResponse] = await Promise.all([
      waitForWrite(page, "POST", "/documents"),
      dock.getByRole("button", { name: "确认执行" }).last().click(),
    ]);
    expect(documentResponse.ok()).toBeTruthy();
    const document = await documentResponse.json();
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/documents/${document.id}$`));
    const documents = await (
      await request.get(c.NEXT_PUBLIC_API_URL + "/documents?projectId=" + project.id, {
        headers: headers(token),
      })
    ).json();
    expect(documents.some((row) => row.title === docTitle)).toBeTruthy();
  } finally {
    if (createdProjectId) {
      await request
        .post(c.NEXT_PUBLIC_API_URL + "/projects/" + createdProjectId + "/archive", {
          headers: headers(token),
        })
        .catch(() => {});
    }
    await page.context().close();
  }
});

test("AI agent refuses writes the current role cannot perform", async ({ browser, request }) => {
  test.setTimeout(180000);
  const token = await login(request, c.TEST_MEMBER_EMAIL);
  const page = await pageFor(browser, token);
  try {
    await page.goto(c.WEB_URL + "/dashboard", { timeout: 120000 });
    await page.getByRole("button", { name: "打开 AI 工作助理" }).click();
    const dock = page.getByRole("dialog", { name: "AI 工作助理" });
    await dock.getByLabel("给 AI 助理的消息").fill("新建工作区「无权限检查」");
    await dock.getByRole("button", { name: "发送" }).click();
    await expect(dock.getByText(/没有.*权限|需要 workspace:add/)).toBeVisible();
    await expect(dock.getByRole("button", { name: "确认执行" })).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});
