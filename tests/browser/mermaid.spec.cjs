const { test, expect } = require("@playwright/test"), {randomUUID}=require("node:crypto"),config=require("./config.cjs");
test("Mermaid authority: official graph/source views, two editors, viewer, offline, diagnostics and reload",async({browser,request})=>{
  const api=config.NEXT_PUBLIC_API_URL,contexts=[];
  const login=async(email)=>{const r=await request.post(api+"/auth/login",{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken;};
  const owner=await login(config.TEST_OWNER_EMAIL),peer=await login(config.TEST_MEMBER_EMAIL),viewer=await login(config.TEST_ADMIN_EMAIL);
  const headers={Authorization:`Bearer ${owner}`,"x-organization-id":config.TEST_ORG};
  const r=await request.post(api+"/documents",{headers,data:{projectId:config.TEST_PROJECT,title:"Mermaid "+randomUUID().slice(0,8),kind:"BOARD"}});expect(r.ok()).toBeTruthy();const d=await r.json();
  for(const [userId,role]of[[config.TEST_MEMBER,"EDITOR"],[config.TEST_ADMIN,"VIEWER"]])expect((await request.put(`${api}/documents/${d.id}/grants`,{headers,data:{userId,role}})).ok()).toBeTruthy();
  const client=async(token)=>{const c=await browser.newContext();contexts.push(c);await c.addInitScript(({token,org})=>{localStorage.setItem("access_token",token);localStorage.setItem("current_org_id",org);},{token,org:config.TEST_ORG});const p=await c.newPage();await p.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${d.id}`);await expect(p.getByLabel("协作 Mermaid 源码")).toBeVisible({timeout:60000});return p;};
  const saved=p=>expect(p.getByRole("status").filter({hasText:"已保存到服务器"})).toBeVisible({timeout:60000});
  const source=p=>p.getByLabel("协作 Mermaid 源码");
  try{
    const a=await client(owner),b=await client(peer),v=await client(viewer);
    await saved(a);await saved(b);await saved(v);await expect(source(v)).toHaveAttribute("readonly", "");
    await a.getByRole("button",{name:"流程图模板",exact:true}).click();
    await expect(source(b)).toHaveValue(/flowchart LR/);await saved(a);
    await expect(a.frameLocator('iframe[title="Mermaid 图表"]').locator("svg")).toBeVisible({timeout:60000});
    for(const value of[
      "sequenceDiagram\n  Alice->>Bob: Hello",
      "mindmap\n  root((Team))\n    Documents\n    People",
      "classDiagram\n  Member --> Document : edits",
      "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Published",
      "erDiagram\n  DOCUMENT ||--o{ COMMENT : contains",
      "flowchart LR\n  subgraph Team\n    A[Plan] --> B[Ship]\n  end",
    ]){await source(a).fill(value);await expect(source(b)).toHaveValue(value);await expect(a.frameLocator('iframe[title="Mermaid 图表"]').locator("svg")).toBeVisible();}
    const current=await source(a).inputValue();
    await Promise.all([source(a).press("Control+Home").then(()=>source(a).pressSequentially("%% owner concurrent\n")),source(b).press("Control+End").then(()=>source(b).pressSequentially("\n%% peer concurrent"))]);
    await expect.poll(()=>source(a).inputValue()).toContain("owner concurrent");await expect.poll(()=>source(a).inputValue()).toContain("peer concurrent");
    await expect.poll(()=>source(b).inputValue()).toBe(await source(a).inputValue());await saved(a);await saved(b);
    await contexts[1].setOffline(true);await source(b).press("Control+End");await source(b).pressSequentially("\n%% offline addition");await contexts[1].setOffline(false);
    await expect(source(a)).toHaveValue(/offline addition/);await saved(b);
    await source(a).fill("flowchart LR\n A[broken");await expect(a.getByLabel("Mermaid 图形预览").getByRole("alert")).toBeVisible();await saved(a);
    await a.reload();await expect(source(a)).toHaveValue("flowchart LR\n A[broken");
    await source(a).fill('%%{init: {securityLevel: "loose"}}%%\nflowchart LR\n A --> B');await expect(a.getByLabel("Mermaid 图形预览").getByRole("alert")).toContainText("禁用");
    await source(a).fill('flowchart LR\n A@{ img: "//example.invalid/image.png", label: "external" }');await expect(a.getByLabel("Mermaid 图形预览").getByRole("alert")).toContainText("禁用");
    await source(a).fill(current);await saved(a);
    const [download]=await Promise.all([a.waitForEvent("download"),a.getByRole("button",{name:"下载 .mmd",exact:true}).click()]);
    expect(download.suggestedFilename()).toBe("collabspace-diagram.mmd");
    expect(require("node:fs").readFileSync(await download.path(),"utf8")).toBe(current);
    await a.getByRole("button",{name:"图形视图",exact:true}).click();await expect(source(a)).toHaveCount(0);await expect(a.frameLocator('iframe[title="Mermaid 图表"]').locator("svg")).toBeVisible();
    await a.getByRole("button",{name:"源码视图",exact:true}).click();await expect(source(a)).toHaveValue(current);
    await a.getByRole("button",{name:"分屏视图",exact:true}).click();
    await expect(a.frameLocator('iframe[title="Mermaid 图表"]').locator("svg")).toBeVisible();
    await a.screenshot({path:"evidence/collaboration/mermaid-workspace.png",fullPage:true});
    await a.reload();await expect(source(a)).toHaveValue(current);await expect(source(v)).toHaveValue(current);
    await a.getByRole("button",{name:"历史版本",exact:true}).click();
    await a.getByLabel("版本名称").fill("Mermaid checkpoint");
    await a.getByRole("button",{name:"创建版本",exact:true}).click();
    await a.getByRole("button",{name:"只读预览",exact:true}).click();
    await expect(a.locator('iframe[title="Mermaid 图表"]')).toHaveCount(2);
    await a.getByRole("button",{name:"关闭预览",exact:true}).click();
    await a.getByRole("button",{name:"恢复为副本",exact:true}).click();
    await expect(a).not.toHaveURL(new RegExp(d.id+"$"));await expect(source(a)).toHaveValue(current);await saved(a);
    expect((await request.get(`${api}/documents/${a.url().split("/").pop()}`,{headers:{Authorization:`Bearer ${peer}`,"x-organization-id":config.TEST_ORG}})).status()).toBe(404);
  }finally{for(const c of contexts)await c.close();}
});
