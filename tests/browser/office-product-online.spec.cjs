const {test,expect}=require('@playwright/test'),c=require('./config.cjs'),fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
test.skip(process.env.OFFICE_PRODUCT_ONLINE_TEST!=='1','Explicit synthetic online acceptance required');
test.setTimeout(360000);
for(const extension of ['docx','xlsx','pptx'])test(extension+': real native editor, rename, saved PDF, private copy and ACL',async({browser,request},info)=>{
 const login=async(email)=>{const r=await request.post(c.NEXT_PUBLIC_API_URL+'/auth/login',{data:{email,password:c.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return(await r.json()).accessToken};
 const token=await login(c.TEST_OWNER_EMAIL),peer=await login(c.TEST_MEMBER_EMAIL),headers={Authorization:'Bearer '+token,'x-organization-id':c.TEST_ORG};
 const bytes=fs.readFileSync('.test-runs/office/fixtures/baseline.'+extension),name='Release-acceptance-'+randomUUID().slice(0,8);
 const uploaded=await request.post(c.NEXT_PUBLIC_API_URL+'/files/upload',{headers,multipart:{projectId:c.TEST_PROJECT,file:{name:name+'.'+extension,mimeType:'application/octet-stream',buffer:bytes}}});expect(uploaded.ok()).toBeTruthy();
 const file=await uploaded.json(),opened=await request.post(c.NEXT_PUBLIC_API_URL+'/office/files/'+file.id+'/open',{headers});expect(opened.ok()).toBeTruthy();const id=(await opened.json()).id;
 const ctx=await browser.newContext({viewport:{width:1600,height:1050}});
 await ctx.addInitScript(({token,org})=>{localStorage.setItem('access_token',token);localStorage.setItem('current_org_id',org);},{token,org:c.TEST_ORG});
 try{
  const page=await ctx.newPage();await page.goto(c.WEB_URL+'/office/'+id);await expect(page.locator('[data-office-ready="true"]')).toBeVisible({timeout:180000});
  expect(page.frames().some(f=>/documenteditor|spreadsheeteditor|presentationeditor/.test(f.url()))).toBeTruthy();
  await page.getByText('文件操作 · 重命名、另存副本、PDF',{exact:true}).click();await page.getByRole('button',{name:'重命名文件',exact:true}).click();
  await page.getByLabel('Office 新文件名').fill(name+'-renamed');await page.getByRole('button',{name:'确认重命名'}).click();await expect(page.getByRole('heading',{level:1})).toHaveText(name+'-renamed.'+extension);
  const downloadPromise=page.waitForEvent('download',{timeout:45000});await page.getByRole('button',{name:'导出该版本PDF'}).click();const download=await downloadPromise;await download.saveAs(info.outputPath(extension+'.pdf'));
  expect(fs.readFileSync(info.outputPath(extension+'.pdf')).subarray(0,5).toString()).toBe('%PDF-');
  const state=await(await request.get(c.NEXT_PUBLIC_API_URL+'/office/'+id+'/state',{headers})).json();expect(state.revision).toBe(1);
  const body=await(await request.get(c.NEXT_PUBLIC_API_URL+'/office/'+id+'/download',{headers})).body();expect(createHash('sha256').update(body).digest('hex')).toBe(createHash('sha256').update(bytes).digest('hex'));
  await page.getByLabel('Office 副本名称').fill(name+'-private');await page.getByRole('button',{name:'另存为私有副本'}).click();await expect(page).not.toHaveURL(new RegExp(id+'$'));
  const copyId=new URL(page.url()).pathname.split('/').pop();await expect(page.locator('[data-office-ready="true"]')).toBeVisible({timeout:180000});
  const copy=await(await request.get(c.NEXT_PUBLIC_API_URL+'/office/'+copyId+'/download',{headers})).body();expect(copy.equals(bytes)).toBe(true);
  const peerHeaders={Authorization:'Bearer '+peer,'x-organization-id':c.TEST_ORG};expect((await request.get(c.NEXT_PUBLIC_API_URL+'/office/'+copyId+'/state',{headers:peerHeaders})).status()).toBe(404);
  expect((await request.post(c.NEXT_PUBLIC_API_URL+'/office/'+id+'/name',{headers:peerHeaders,data:{title:'Denied',expectedTitle:state.title}})).status()).toBe(404);
  expect((await request.get(c.NEXT_PUBLIC_API_URL+'/office/'+id+'/state',{headers:{...headers,'x-organization-id':randomUUID()}})).status()).toBe(403);
  if(extension==='pptx'){
   await page.getByText('图片上传慢？先缩小图片',{exact:true}).click();await page.getByLabel('准备插入的图片').setInputFiles('.test-runs/ppt-image-profile/small.png');await page.getByLabel('图片质量').selectOption('small');await page.getByRole('button',{name:'生成预览',exact:true}).click();
   await expect(page.getByRole('img',{name:'待插入图片预览'})).toBeVisible();const preparedPromise=page.waitForEvent('download');await page.getByRole('link',{name:'下载待插入图片'}).click();await(await preparedPromise).saveAs(info.outputPath('prepared-image.webp'));
  }
  await page.screenshot({path:info.outputPath('native-'+extension+'.png'),fullPage:true});
  fs.writeFileSync(info.outputPath('result.json'),JSON.stringify({extension,sourceId:id,copyId,revision:1,pdf:true,sourceUnchanged:true,private:true},null,2));
 }finally{await ctx.close()}
});
