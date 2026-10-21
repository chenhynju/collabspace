const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const config = require("./config.cjs");
test("diagram workspace: bound connectors, mind branches, Mermaid preview/import, SVG export and multi-account persistence", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const contexts = [],
    api = config.NEXT_PUBLIC_API_URL;
  const login = async (email) => {
    const r = await request.post(api + "/auth/login", {
      data: { email, password: config.TEST_PASSWORD },
    });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).accessToken;
  };
  const owner = await login(config.TEST_OWNER_EMAIL),
    member = await login(config.TEST_MEMBER_EMAIL),
    viewer = await login(config.TEST_ADMIN_EMAIL);
  const headers = {
    Authorization: `Bearer ${owner}`,
    "x-organization-id": config.TEST_ORG,
  };
  const r = await request.post(api + "/documents", {
    headers,
    data: {
      projectId: config.TEST_PROJECT,
      title: "Diagram " + randomUUID().slice(0, 8),
      kind: "BOARD",
    },
  });
  expect(r.ok()).toBeTruthy();
  const doc = await r.json();
  for (const [userId, role] of [
    [config.TEST_MEMBER, "EDITOR"],
    [config.TEST_ADMIN, "VIEWER"],
  ])
    expect(
      (
        await request.put(`${api}/documents/${doc.id}/grants`, {
          headers,
          data: { userId, role },
        })
      ).ok(),
    ).toBeTruthy();
  const client = async (token) => {
    const c = await browser.newContext({ acceptDownloads: true });
    contexts.push(c);
    await c.addInitScript(
      ({ token, org }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("current_org_id", org);
      },
      { token, org: config.TEST_ORG },
    );
    const p = await c.newPage();
    await p.goto(
      `${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${doc.id}`,
    );
    await p.getByRole("button", { name: "自由画布", exact: true }).click();
    await expect(p.getByTestId("whiteboard-canvas")).toBeVisible();
    return p;
  };
  const saved = (p) =>
    expect(p.getByText("已保存到服务器", { exact: false })).toBeVisible({
      timeout: 60000,
    });
  try {
    const a = await client(owner),
      b = await client(member),
      v = await client(viewer);
    await saved(a);
    await saved(b);
    await saved(v);
    const canvas = (p) => p.getByTestId("whiteboard-canvas"),
      shapes = (p) => canvas(p).getByTestId("board-shape");
    await expect(
      v.getByRole("button", { name: "思维导图模板", exact: true }),
    ).toBeDisabled();
    await a.getByRole("button", { name: "Mermaid 源码", exact: true }).click();
    await a
      .getByLabel("Mermaid 源码输入")
      .fill("flowchart LR\n A[开始] --> B{验收}\n B -->|通过| C((交付))");
    await a.getByRole("button", { name: "解析预览", exact: true }).click();
    await expect(a.getByLabel("Mermaid 导入预览")).toBeVisible();
    await expect(shapes(a)).toHaveCount(0);
    await a.getByRole("button", { name: "追加到白板", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(5);
    await expect(shapes(v)).toHaveCount(5);
    await a
      .getByLabel("Mermaid 源码输入")
      .fill("flowchart LR\nclick A javascript:alert(1)");
    await a.getByRole("button", { name: "解析预览", exact: true }).click();
    await expect(a.locator('p[role="alert"]')).toBeVisible();
    await expect(
      a.getByRole("button", { name: "追加到白板", exact: true }),
    ).toBeDisabled();
    await expect(shapes(b)).toHaveCount(5);
    await a.getByRole("button", { name: "Mermaid 源码", exact: true }).click();
    const edge = canvas(b).getByTestId("bound-connector").first(),
      before = await edge.getAttribute("d");
    const start = canvas(a).getByRole("button", {
      name: "rect: 开始",
      exact: true,
    });
    await start.scrollIntoViewIfNeeded();
    const box = await start.boundingBox();
    await a.mouse.move(box.x + 30, box.y + 30);
    await a.mouse.down();
    await a.mouse.move(box.x + 50, box.y + 150, { steps: 8 });
    await a.mouse.up();
    await saved(a);
    await expect(edge).not.toHaveAttribute("d", before);
    await a.getByRole("button", { name: "思维导图模板", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(9);
    await expect(canvas(b).getByTestId("mind-branch")).toHaveCount(3);
    await a.getByRole("button", { name: "添加子主题", exact: true }).click();
    await saved(a);
    await expect(canvas(b).getByTestId("mind-branch")).toHaveCount(4);
    await a.getByLabel("图形文字").fill("联合交付");
    await saved(a);
    await b.getByRole("button", { name: "自动布局导图", exact: true }).click();
    await saved(b);
    await expect(
      canvas(b).getByRole("button", { name: "mind: 联合交付", exact: true }),
    ).toBeVisible();
    await a.context().setOffline(true);
    await a.getByRole("button", { name: "添加子主题", exact: true }).click();
    await expect(
      a.getByText("已保存到此设备 · 离线", { exact: false }),
    ).toBeVisible();
    await canvas(b)
      .getByRole("button", { name: "diamond: 验收", exact: true })
      .click();
    await b.getByLabel("图形文字").fill("成员验收");
    await saved(b);
    await a.context().setOffline(false);
    await saved(a);
    await expect(shapes(b)).toHaveCount(11);
    await a.getByRole("button", { name: "撤销", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(10);
    await expect(
      canvas(a).getByRole("button", { name: "diamond: 成员验收", exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "重做", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(11);
    const download = a.waitForEvent("download");
    await a.getByRole("button", { name: "导出 SVG", exact: true }).click();
    const svg = await download;
    expect(svg.suggestedFilename()).toBe("collabspace-diagram.svg");
    const fs = require("node:fs");
    const data = fs.readFileSync(await svg.path(), "utf8");
    expect(data).toContain("联合交付");
    expect(data).toContain("<svg");
    expect(data).not.toContain("board-resize");
    await a.reload();
    await saved(a);
    await expect(shapes(a)).toHaveCount(11);
    await expect(canvas(a).getByTestId("bound-connector")).toHaveCount(2);
    await expect(canvas(a).getByTestId("mind-branch")).toHaveCount(5);
    await a.screenshot({
      path: "evidence/collaboration/diagram-workspace.png",
      fullPage: true,
    });
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()));
  }
});
