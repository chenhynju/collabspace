const {test,expect}=require('@playwright/test');
const site=process.env.PERSONA_MOTION_FIXTURE_URL||'';
test.skip(!site,'Local persona fixture only: set PERSONA_MOTION_FIXTURE_URL (e.g. http://127.0.0.1:14420)');
test('real WebGL character renders, moves, changes action and resets',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('access_token','synthetic-fixture-token');localStorage.setItem('current_org_id','fixture-org');});
 await page.route('**/api/v1/**',async route=>{const p=new URL(route.request().url()).pathname;let data=[];if(p.endsWith('/users/me'))data={id:'owner',name:'Synthetic owner',organizations:[{id:'fixture-org',name:'Fixture',status:'ACTIVE',membershipStatus:'ACTIVE'}]};if(p.endsWith('/organizations/current'))data={perms:['*'],roleKeys:['OWNER']};return route.fulfill({json:data});});
 await page.goto(site+'/personas/studio');await page.getByRole('button',{name:'对比旧版动作原型'}).click();await expect(page.getByRole('status').filter({hasText:'3D场景已就绪'})).toBeVisible();
 const canvas=page.getByLabel('三维角色场景，方向键或WASD移动');await expect(canvas).toBeVisible();
 const before=await canvas.screenshot();await page.getByRole('button',{name:'挥手',exact:true}).click();await expect(page.getByRole('button',{name:'挥手',exact:true})).toHaveAttribute('aria-pressed','true');const after=await canvas.screenshot();expect(before.equals(after)).toBe(false);
 await canvas.focus();await page.keyboard.down('w');await expect(page.getByLabel('角色位置')).not.toHaveText('X 0.00 · Z 0.00');await page.keyboard.up('w');
 await page.getByRole('button',{name:'回到原点'}).click();await expect(page.getByLabel('角色位置')).toHaveText('X 0.00 · Z 0.00');
 await page.getByRole('button',{name:'点头',exact:true}).click();await expect(page.getByRole('button',{name:'点头',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const [name,id] of [['知夏','female-02'],['知行','male-01'],['明悦','female-06']]){await page.getByRole('button').filter({has:page.getByAltText(name+'原始静态形象')}).click();await expect(page.getByRole('heading',{name:name+' · 可动3D Agent',exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'3D场景已就绪'})).toBeVisible();await page.getByRole('button',{name:'挥手',exact:true}).click();await canvas.screenshot({path:'.test-runs/3d-agent/'+id+'.png'});await expect(page.getByLabel('角色位置')).toHaveText('X 0.00 · Z 0.00');}
 await page.screenshot({path:'.test-runs/3d-agent/studio.png',fullPage:true});await expect(page.getByRole('main',{name:'3D Agent实验室',exact:true}).getByRole('alert')).toHaveCount(0);
});

test('licensed skinned VRM loads, animates and switches facial expression',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('access_token','synthetic-fixture-token');localStorage.setItem('current_org_id','fixture-org');});
 await page.route('**/api/v1/**',async route=>{const p=new URL(route.request().url()).pathname;let data=[];if(p.endsWith('/users/me'))data={id:'owner',name:'Synthetic owner',organizations:[{id:'fixture-org',name:'Fixture',status:'ACTIVE',membershipStatus:'ACTIVE'}]};if(p.endsWith('/organizations/current'))data={perms:['*'],roleKeys:['OWNER']};return route.fulfill({json:data});});

 await page.goto(site+'/personas/studio');
 const stage=page.getByRole('region',{name:'完整骨骼人物预览',exact:true});await expect(stage.getByRole('status')).toHaveText('骨骼人物已就绪',{timeout:90000});
 const canvas=page.getByLabel('完整骨骼人物三维场景');const before=await canvas.screenshot();
 await stage.getByRole('button',{name:'微笑',exact:true}).click();await expect(stage.getByRole('button',{name:'微笑',exact:true})).toHaveAttribute('aria-pressed','true');
 const after=await canvas.screenshot();expect(before.equals(after)).toBe(false);
 await stage.getByRole('button',{name:'挥手',exact:true}).click();await canvas.screenshot({path:'.test-runs/3d-agent/rigged-avatar.png'});
 await expect(stage.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'对比旧版动作原型'}).click();await page.getByRole('button',{name:'查看完整骨骼人物'}).click();await expect(stage.getByRole('status')).toHaveText('骨骼人物已就绪',{timeout:90000});await expect(page.getByLabel('完整骨骼人物三维场景')).toHaveCount(1);
});
