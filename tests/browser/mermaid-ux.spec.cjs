const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const c = require("./config.cjs");

test("Mermaid editor: minimal tools, text editing for flow/mindmap, drag shape and AI prompt entry", async ({
  browser,
  request,
}) => {
  test.setTimeout(240000);
  const login = await request.post(c.NEXT_PUBLIC_API_URL + "/auth/login", {
    data: { email: c.TEST_OWNER_EMAIL, password: c.TEST_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).accessToken;
  const headers = { Authorization: "Bearer " + token, "x-organization-id": c.TEST_ORG };
  const made = await request.post(c.NEXT_PUBLIC_API_URL + "/documents", {
    headers,
    data: {
      projectId: c.TEST_PROJECT,
      title: "Mermaid UX " + randomUUID().slice(0, 8),
      kind: "BOARD",
    },
  });
  expect(made.ok()).toBeTruthy();
  const doc = await made.json();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(
    ({ token, org }) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("current_org_id", org);
    },
    { token, org: c.TEST_ORG },
  );
  const page = await context.newPage();
  try {
    await page.goto(`${c.WEB_URL}/projects/${c.TEST_PROJECT}/documents/${doc.id}`, {
      timeout: 120000,
    });
    const source = page.getByLabel("协作 Mermaid 源码");
    await expect(source).toBeVisible({ timeout: 60000 });
    await source.fill(
      'flowchart LR\n  A@{ shape: rect, label: "开始" }\n  B@{ shape: diamond, label: "判断" }\n  A --> B',
    );
    await page.waitForTimeout(1200);

    await expect(page.getByRole("button", { name: "AI 生成图表", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "AI 生成图表", exact: true }).click();
    await expect(page.getByRole("button", { name: "语音输入图表要求", exact: true })).toBeVisible();
    await expect(page.getByLabel("图表修改要求")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "流程节点 开始", exact: true }).click();
    await page.getByLabel("选中节点名称").fill("启动");
    await page.getByRole("button", { name: "更新节点名称", exact: true }).click();
    await expect(source).toHaveValue(/label: "启动"/);

    await page.getByLabel("新节点名称").fill("人工复核");
    await page
      .getByRole("button", { name: "处理图元", exact: true })
      .dragTo(page.getByLabel("Mermaid 图形画布", { exact: true }));
    await expect(source).toHaveValue(/人工复核/);

    await source.fill("mindmap\n  root((项目))\n    需求\n    设计");
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "思维主题 需求", exact: true }).click();
    await page.getByLabel("选中节点名称").fill("需求分析");
    await page.getByRole("button", { name: "更新节点名称", exact: true }).click();
    await expect(source).toHaveValue(/需求分析/);
    await page.getByLabel("子主题文字").fill("需求评审");
    await page.getByRole("button", { name: "添加子主题", exact: true }).click();
    await expect(source).toHaveValue(/需求评审/);

    await expect(page.getByText("1. 添加主题", { exact: false })).toBeVisible();
    await expect(page.getByText("第一次用？查看三步说明", { exact: false })).toBeVisible();
    await expect(page.locator('iframe[title="Mermaid 图表"]')).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: ".test-runs/mermaid-ux-main.png", fullPage: true });
  } finally {
    await context.close();
  }
});
