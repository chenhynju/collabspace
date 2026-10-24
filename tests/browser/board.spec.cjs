const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const config = require("./config.cjs");
test("whiteboard: discover, draw, concurrent accounts, cursors, undo, offline replay, viewer and private version copy", async ({
  browser,
  request,
}) => {
  const contexts = [];
  const diagnostics=[];
  const api = config.NEXT_PUBLIC_API_URL;
  async function login(email) {
    const r = await request.post(`${api}/auth/login`, {
      data: { email, password: config.TEST_PASSWORD },
    });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).accessToken;
  }
  const owner = await login(config.TEST_OWNER_EMAIL),
    member = await login(config.TEST_MEMBER_EMAIL),
    viewer = await login(config.TEST_ADMIN_EMAIL);
  const headers = {
    Authorization: `Bearer ${owner}`,
    "x-organization-id": config.TEST_ORG,
  };
  async function pageFor(token, path) {
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
    if(process.env.COLLAB_WS_DIAGNOSTICS){
      const Y=require('../../packages/collab-store/node_modules/yjs'),state=new Y.Doc(),page=contexts.length;
      p.on('websocket',ws=>{if(!ws.url().includes('/collab'))return;
        ws.on('framesent',event=>{try{const m=JSON.parse(String(event.payload));diagnostics.push({page,direction:'sent',type:m.type,docId:m.type==='auth'?m.docId:undefined,updateId:m.updateId});}catch{}});
        ws.on('close',()=>diagnostics.push({page,type:'closed'}));
        ws.on('framereceived',event=>{try{const m=JSON.parse(String(event.payload));if(m.type==='synced'||m.type==='remote')Y.applyUpdate(state,Buffer.from(m.update,'base64'));diagnostics.push({page,type:m.type,seq:m.seq,code:m.code,shapes:state.getMap('shapes').size,pending:!!state.store.pendingStructs});}catch{diagnostics.push({page,type:'decode-error'});}});
      });
    }
    await p.goto(config.WEB_URL + path);
    if (path.includes("/documents/")) await p.getByRole("button", { name: "自由画布", exact: true }).click();
    return p;
  }
  const saved = (p) =>
    expect(p.getByText("已保存到服务器", { exact: false })).toBeVisible({
      timeout: 60000,
    });
  const shapes = (p) => p.getByTestId("board-shape");
  try {
    const a = await pageFor(owner, "/collaboration");
    await expect(
      a.getByRole("heading", { name: "让团队始终编辑同一份文档。" }),
    ).toBeVisible();
    await a
      .locator(`a[href="/projects/${config.TEST_PROJECT}/content"]`)
      .click();
    const title = "Whiteboard " + randomUUID().slice(0, 8);
    await a.getByRole("button",{name:"新建 白板 / Mermaid",exact:true}).click();
      await a.getByLabel("新内容标题").fill(title);
    await a.getByRole("button", { name: "创建并打开", exact: true }).click();
    await a.getByRole("heading", { name: title, exact: true }).click();
    await a.getByRole("button", { name: "自由画布", exact: true }).click();
    await expect(a.getByTestId("whiteboard-canvas")).toBeVisible();
    await saved(a);
    const id = a.url().split("/").pop(),
      path = new URL(a.url()).pathname;
    for (const [userId, role] of [
      [config.TEST_MEMBER, "EDITOR"],
      [config.TEST_ADMIN, "VIEWER"],
    ])
      expect(
        (
          await request.put(`${api}/documents/${id}/grants`, {
            headers,
            data: { userId, role },
          })
        ).ok(),
      ).toBeTruthy();
    const b = await pageFor(member, path),
      v = await pageFor(viewer, path);
    await saved(b);
    await saved(v);
    await expect(
      v.getByRole("button", { name: "矩形", exact: true }),
    ).toBeDisabled();
    await a.getByRole("button", { name: "矩形", exact: true }).click();
    await a
      .getByTestId("whiteboard-canvas")
      .click({ position: { x: 100, y: 100 } });
    await a.getByLabel("图形文字").fill("Architecture");
    await saved(a);
    await expect(shapes(b).filter({ hasText: "Architecture" })).toHaveCount(1);
    await expect(shapes(v)).toHaveCount(1);
    const first = shapes(a).first();
    const x = Number(await first.locator("rect").first().getAttribute("x"));
    const box = await first.boundingBox();
    await a.mouse.move(box.x + 30, box.y + 30);
    await a.mouse.down();
    await a.mouse.move(box.x + 110, box.y + 70, { steps: 8 });
    await a.mouse.up();
    await saved(a);
    await expect
      .poll(async () =>
        Number(
          await shapes(b).first().locator("rect").first().getAttribute("x"),
        ),
      )
      .not.toBe(x);
    await b.getByRole("button", { name: "便签", exact: true }).click();
    await b
      .getByTestId("whiteboard-canvas")
      .click({ position: { x: 380, y: 210 } });
    await b.getByLabel("图形文字").fill("Remote idea");
    await saved(b);
    await expect(shapes(a)).toHaveCount(2);
    await a.getByRole("button", { name: "撤销", exact: true }).click();
    await saved(a);
    await expect
      .poll(async () =>
        Number(
          await shapes(b)
            .filter({ hasText: "Architecture" })
            .locator("rect")
            .first()
            .getAttribute("x"),
        ),
      )
      .toBe(x);
    await expect(shapes(a).filter({ hasText: "Remote idea" })).toHaveCount(1);
    const canvasBox = await b.getByTestId("whiteboard-canvas").boundingBox();
    await b.mouse.move(canvasBox.x + 220, canvasBox.y + 190);
    await expect(a.getByLabel("陆小鹿 的白板光标")).toBeVisible();
    await b.context().setOffline(true);
    await b.getByLabel("图形文字").fill("Offline idea");
    await expect(
      b.getByText("已保存到此设备 · 离线", { exact: false }),
    ).toBeVisible();
    await a.getByRole("button", { name: "椭圆", exact: true }).click();
    await a
      .getByTestId("whiteboard-canvas")
      .click({ position: { x: 520, y: 90 } });
    await saved(a);
    await b.context().setOffline(false);
    await saved(b);
    await expect(shapes(a).filter({ hasText: "Offline idea" })).toHaveCount(1);
    await expect(shapes(b)).toHaveCount(3);
    await a.getByRole("button", { name: "历史版本", exact: true }).click();
    await a.getByLabel("版本名称").fill("Board checkpoint");
    await a.getByRole("button", { name: "创建版本", exact: true }).click();
    await a.getByRole("button", { name: "只读预览", exact: true }).click();
    await expect(a.getByLabel("白板历史只读预览")).toBeVisible();
    await a.getByRole("button", { name: "关闭预览", exact: true }).click();
    await a.screenshot({
      path: "evidence/collaboration/board-owner.png",
      fullPage: true,
    });
    await b.screenshot({
      path: "evidence/collaboration/board-member.png",
      fullPage: true,
    });
    await a.getByRole("button", { name: "恢复为副本", exact: true }).click();
    await expect(a).not.toHaveURL(new RegExp(`${id}$`));
    await expect(shapes(a)).toHaveCount(3);
    await saved(a);
    const copyId = a.url().split("/").pop();
    expect(
      (
        await request.get(`${api}/documents/${copyId}`, {
          headers: {
            Authorization: `Bearer ${member}`,
            "x-organization-id": config.TEST_ORG,
          },
        })
      ).status(),
    ).toBe(404);
    await b.reload();
    await saved(b);
    await expect(shapes(b)).toHaveCount(3);
    await b.context().setOffline(true);
    await shapes(b).filter({ hasText: "Offline idea" }).click();
    await b.getByLabel("图形文字").fill("Revoked private draft");
    expect(
      (
        await request.put(`${api}/documents/${id}/grants`, {
          headers,
          data: { userId: config.TEST_MEMBER, role: "REMOVE" },
        })
      ).ok(),
    ).toBeTruthy();
    await b.context().setOffline(false);
    await expect(
      b.getByText("权限已撤销，未同步草稿可导出", { exact: false }),
    ).toBeVisible();
    await expect(
      shapes(v).filter({ hasText: "Revoked private draft" }),
    ).toHaveCount(0);
  } finally {
    for (const c of contexts) await c.close();
    if(process.env.COLLAB_WS_DIAGNOSTICS)require('node:fs').writeFileSync('.test-runs/richtext-board-ws.json',JSON.stringify(diagnostics,null,2));
  }
});
