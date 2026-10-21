const { test, expect } = require("@playwright/test"),
  { randomUUID } = require("node:crypto"),
  config = require("./config.cjs");
const { shapeCatalog } = require("../../packages/collab-protocol");
test("shape library: native drag-drop, edit/move/resize/type, duplicate/undo and durable multi-account rendering", async ({
  browser,
  request,
}) => {
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
    peer = await login(config.TEST_MEMBER_EMAIL),
    viewer = await login(config.TEST_ADMIN_EMAIL),
    headers = {
      Authorization: `Bearer ${owner}`,
      "x-organization-id": config.TEST_ORG,
    };
  const r = await request.post(api + "/documents", {
    headers,
    data: {
      projectId: config.TEST_PROJECT,
      title: "Palette " + randomUUID().slice(0, 8),
      kind: "BOARD",
    },
  });
  expect(r.ok()).toBeTruthy();
  const d = await r.json();
  for (const [userId, role] of [
    [config.TEST_MEMBER, "EDITOR"],
    [config.TEST_ADMIN, "VIEWER"],
  ])
    expect(
      (
        await request.put(`${api}/documents/${d.id}/grants`, {
          headers,
          data: { userId, role },
        })
      ).ok(),
    ).toBeTruthy();
  const client = async (token) => {
    const c = await browser.newContext();
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
      `${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${d.id}`,
    );
    await p.getByRole("button", { name: "自由画布", exact: true }).click();
    await expect(p.getByTestId("whiteboard-canvas")).toBeVisible({
      timeout: 60000,
    });
    return p;
  };
  const saved = (p) =>
    expect(
      p.getByRole("status").filter({ hasText: "已保存到服务器" }),
    ).toBeVisible({ timeout: 60000 });
  try {
    const a = await client(owner),
      b = await client(peer),
      v = await client(viewer);
    await saved(a);
    await saved(b);
    await saved(v);
    const canvas = (p) => p.getByTestId("whiteboard-canvas"),
      shapes = (p) => canvas(p).getByTestId("board-shape");
    for (const [i, s] of shapeCatalog.entries()) {
      await expect(
        v.getByRole("button", { name: "图元 " + s.label, exact: true }),
      ).toBeDisabled();
      await a
        .getByRole("button", { name: "图元 " + s.label, exact: true })
        .dragTo(canvas(a), { targetPosition: { x: 160 + i * 30, y: 160 } });
      await expect(a.getByLabel("图形文字")).toHaveValue(s.label);
      for (const [label, value] of [
        ["图形X", String(80 + (i % 4) * 230)],
        ["图形Y", String(80 + Math.floor(i / 4) * 210)],
      ]) {
        await a.getByLabel(label, { exact: true }).fill(value);
        await a.getByLabel(label, { exact: true }).press("Enter");
      }
      await a.getByLabel("图形文字").fill(s.label + " 协作");
      await saved(a);
      await expect(shapes(b)).toHaveCount(i + 1);
    }
    await a.getByRole("button", { name: "适应全部", exact: true }).click();
    await b.getByRole("button", { name: "适应全部", exact: true }).click();
    await a.getByLabel("图形宽度", { exact: true }).fill("240");
    await a.getByLabel("图形宽度", { exact: true }).press("Enter");
    await saved(a);
    await expect(
      canvas(b)
        .getByRole("button", { name: "actor: 参与者 协作", exact: true })
        .locator("rect")
        .first(),
    ).toHaveAttribute("width", "240");
    await a.getByLabel("图形类型").selectOption("cloud");
    await saved(a);
    await expect(
      canvas(b).getByRole("button", {
        name: "cloud: 参与者 协作",
        exact: true,
      }),
    ).toBeVisible();
    const item = canvas(a).getByRole("button", {
      name: "cloud: 参与者 协作",
      exact: true,
    });
    await item.scrollIntoViewIfNeeded();
    const before = await item.locator("rect").first().getAttribute("x"),
      box = await item.boundingBox();
    await a.mouse.move(box.x + 20, box.y + 20);
    await a.mouse.down();
    await a.mouse.move(box.x + 55, box.y + 45, { steps: 6 });
    await a.mouse.up();
    await saved(a);
    await expect(
      canvas(b)
        .getByRole("button", { name: "cloud: 参与者 协作", exact: true })
        .locator("rect")
        .first(),
    ).not.toHaveAttribute("x", before);
    await a.getByRole("button", { name: "复制图形", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(9);
    await a.getByRole("button", { name: "撤销", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(8);
    await a.getByRole("button", { name: "重做", exact: true }).click();
    await saved(a);
    await expect(shapes(b)).toHaveCount(9);
    await a.reload();
    await saved(a);
    await expect(shapes(a)).toHaveCount(9);
    await expect(shapes(v)).toHaveCount(9);
    await a.screenshot({
      path: "evidence/collaboration/palette-workspace.png",
      fullPage: true,
    });
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()));
  }
});
