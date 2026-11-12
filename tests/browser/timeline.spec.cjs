const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const {Store,materialize}=require('../../packages/collab-store/index.cjs');
const Y=require('../../packages/collab-store/node_modules/yjs');
const config=require('./config.cjs');

test('real timeline: automatic sample, newer named snapshot, slider, navigation and private restore',async({page,request})=>{
 test.setTimeout(420000);
 test.skip(!config.COLLAB_TEST_DATABASE_URL,'Requires isolated local database');
 const store=new Store(config.COLLAB_TEST_DATABASE_URL),ctx={org:config.TEST_ORG,user:config.TEST_OWNER};
 let y;
 try{
  const d=await store.create(ctx,config.TEST_PROJECT,{title:'Snapshot UI '+randomUUID(),kind:'MARKDOWN',source:'Timeline initial'});
  y=materialize(Buffer.from((await store.sync(ctx,d.id,'AA==')).update,'base64'));
  y.getText('markdown').insert(y.getText('markdown').length,' first');
  await store.update(ctx,d.id,{updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(y)).toString('base64')});
  y.getText('markdown').insert(y.getText('markdown').length,' final');
  await store.update(ctx,d.id,{updateId:randomUUID(),update:Buffer.from(Y.encodeStateAsUpdate(y)).toString('base64')});
  await store.version(ctx,d.id,{id:randomUUID(),name:'Final delivery'});
  const login=await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`,{data:{email:config.TEST_OWNER_EMAIL,password:config.TEST_PASSWORD}});
  expect(login.ok()).toBeTruthy();const token=(await login.json()).accessToken;
  await page.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:ctx.org});
  await page.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${d.id}`);
  await page.getByRole('button',{name:'历史版本',exact:true}).click();
  await expect(page.getByText('快照时间轴',{exact:true})).toBeVisible();
  await expect(page.getByText('自动快照',{exact:true})).toBeVisible();
  const slider=page.getByRole('slider',{name:'快照时间轴'});
  await slider.focus();await slider.press('Home');
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Timeline initial first');
  await expect(dialog).not.toContainText('Timeline initial first final');
  await dialog.getByRole('button',{name:'更新快照',exact:true}).click();
  await expect(dialog).toContainText('Timeline initial first final');
  await dialog.getByRole('button',{name:'更早快照',exact:true}).click();
  await expect(dialog).not.toContainText('Timeline initial first final');
  await page.screenshot({path:'.test-runs/timeline-preview.png',fullPage:true});
  await dialog.getByRole('button',{name:'关闭预览'}).click();
  await page.getByRole('button',{name:'立即保留快照'}).click();
  await expect.poll(async()=> (await store.versions(ctx,d.id)).length).toBe(3);
  const original=page.getByText('自动快照',{exact:true}).locator('..');
  await original.getByRole('button',{name:'恢复为副本'}).click();
  await expect(page).not.toHaveURL(new RegExp(d.id));
  await expect(page.getByRole('heading',{name:/恢复副本/})).toBeVisible();
 }finally{y?.destroy();await store.close();}
});
