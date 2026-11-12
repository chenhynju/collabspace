const {test,expect}=require('@playwright/test');
const site=process.env.MEETINGS_FIXTURE_URL||'http://127.0.0.1:14420';
test('meeting lifecycle and persisted chat UI with explicit API fixture',async({page})=>{
 let meetings=[],messages=[],creates=0;
 await page.addInitScript(()=>{localStorage.setItem('access_token','synthetic-fixture-token');localStorage.setItem('current_org_id','fixture-org');});
 await page.route('**/api/v1/**',async route=>{const r=route.request(),p=new URL(r.url()).pathname.replace('/api/v1','');let data=[];
 if(p==='/users/me')data={id:'owner',name:'Synthetic owner',email:'owner@acme.dev',organizations:[{id:'fixture-org',name:'Fixture organization',status:'ACTIVE',membershipStatus:'ACTIVE'}]};
 else if(p==='/organizations/current')data={perms:['*'],roleKeys:['OWNER']};
 else if(p==='/meetings/status')data={enabled:true,configured:false};
 else if(p==='/meetings'&&r.method()==='POST'){creates++;const b=r.postDataJSON();data={id:b.requestId,title:b.title,status:'ACTIVE',host_id:'owner'};meetings=[data];}
 else if(p==='/meetings')data=meetings;
 else if(p.endsWith('/end')){meetings[0].status='ENDED';data=meetings[0];}
 else if(p.endsWith('/messages')&&r.method()==='POST'){const b=r.postDataJSON();data={id:b.requestId,sender_id:'owner',body:b.text,created_at:new Date().toISOString()};messages.push(data);}
 else if(p.endsWith('/messages'))data=messages.slice().reverse();
 return route.fulfill({json:data});});
 await page.goto(site+'/projects/project-one/meetings');
 await expect(page.getByText('音视频服务尚未配置。',{exact:false})).toBeVisible();
 await page.getByLabel('会议名称').fill('Local fixture review');await page.getByRole('button',{name:'创建会议',exact:true}).click();
 await expect(page.getByText('Local fixture review',{exact:true})).toBeVisible();expect(creates).toBe(1);
 await expect(page.getByRole('button',{name:'加入会议',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'聊天记录',exact:true}).click();
 await page.getByLabel('会议消息').fill('<script>literal only</script>');await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await expect(page.getByText('<script>literal only</script>',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'关闭聊天'}).click();await page.getByRole('button',{name:'聊天记录',exact:true}).click();
 await expect(page.getByText('<script>literal only</script>',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'结束会议',exact:true}).click();await expect(page.getByText('已结束',{exact:true})).toBeVisible();
 await expect(page.getByLabel('会议消息')).toBeDisabled();
});


test('meeting device permissions fail clearly and local synthetic preview tracks are released',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('access_token','synthetic-fixture-token');localStorage.setItem('current_org_id','fixture-org');window.__stopped=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{enumerateDevices:async()=>[{kind:'videoinput',deviceId:'camera-test',label:'合成摄像头'}],addEventListener:()=>{},removeEventListener:()=>{},getUserMedia:async c=>{if(c.audio)throw new DOMException('permission denied','NotAllowedError');const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;canvas.getContext('2d').fillRect(0,0,160,90);const stream=canvas.captureStream(1);for(const t of stream.getTracks()){const stop=t.stop.bind(t);t.stop=()=>{window.__stopped++;stop();};}return stream;}}});});
 await page.route('**/api/v1/**',async route=>{const p=new URL(route.request().url()).pathname;let data=[];if(p.endsWith('/users/me'))data={id:'owner',name:'Fixture',organizations:[{id:'fixture-org',name:'Fixture',status:'ACTIVE',membershipStatus:'ACTIVE'}]};if(p.endsWith('/organizations/current'))data={perms:['*'],roleKeys:['OWNER']};if(p.endsWith('/meetings/status'))data={enabled:true,configured:false};return route.fulfill({json:data});});
 await page.goto(site+'/projects/project-one/meetings');const section=page.getByRole('region',{name:'入会设备检查'});await expect(section).toBeVisible();await section.getByRole('button',{name:'测试麦克风'}).click();await expect(section.getByRole('alert')).toHaveText('设备权限被拒绝，请在浏览器设置中允许后重试。');
 await page.getByLabel('选择摄像头').selectOption('camera-test');await section.getByRole('button',{name:'预览摄像头'}).click();await expect(section.getByRole('status')).toContainText('摄像头预览中');await section.getByRole('button',{name:'停止设备测试'}).click();expect(await page.evaluate(()=>window.__stopped)).toBe(1);await expect(section.getByRole('status')).toContainText('摄像头未开启');
 await section.getByRole('button',{name:'预览摄像头'}).click();await expect(section.getByRole('status')).toContainText('摄像头预览中');await page.getByRole('link',{name:'返回项目',exact:true}).click();await page.waitForFunction(()=>window.__stopped===2);
});
