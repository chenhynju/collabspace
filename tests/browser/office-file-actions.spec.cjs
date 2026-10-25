const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const web=createRequire(path.resolve('apps/web/package.json')),ts=web('typescript');
for(const extension of ['docx','xlsx','pptx'])test(extension+': rename, version-specific PDF, copy timeout retry keeps intent and viewer cannot mutate',async({page})=>{
 await page.route('http://localhost/office-component-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('http://localhost/office-component-test');
 for(const name of ['react','react-dom'])await page.addScriptTag({path:path.join(path.dirname(web.resolve(name+'/package.json')),'umd',name+'.development.js')});
 const source=ts.transpileModule(fs.readFileSync('apps/web/src/components/office-file-actions.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
 await page.evaluate(({source,extension})=>{
  const exports={};window.calls=[];window.copyCalls=0;window.copied='';
  const api={post:async(url,data)=>{window.calls.push({url,data});if(url.endsWith('/name'))return {data:{title:data.title+'.'+extension}};
   if(url.endsWith('/copy')){if(++window.copyCalls===1)throw {response:{status:502}};return {data:{id:'new-private-copy'}};}
   return {data:new Blob(['%PDF-1.4\nSynthetic browser stub\n%%EOF'],{type:'application/pdf'})};}};
  new Function('exports','require','React',source)(exports,n=>n==='react'?window.React:{api},window.React);
  const div=document.createElement('div');document.body.append(div);window.root=window.ReactDOM.createRoot(div);window.Component=exports.OfficeFileActions;
  window.props={documentId:'synthetic',title:'Synthetic.'+extension,role:'OWNER',versions:[{id:'v1',revision:1},{id:'candidate',revision:null},{id:'v2',revision:2}],onRenamed:t=>{window.renamed=t},onCopy:id=>{window.copied=id}};
  window.root.render(window.React.createElement(window.Component,window.props));
 },{source,extension});
 await page.getByText('文件操作 · 重命名、另存副本、PDF',{exact:true}).click();
 await page.getByRole('button',{name:'重命名文件',exact:true}).click();await page.getByLabel('Office 新文件名').fill('Renamed');await page.getByRole('button',{name:'确认重命名'}).click();
 await expect.poll(()=>page.evaluate(()=>window.renamed)).toBe('Renamed.'+extension);
 await expect(page.getByLabel('Office 操作来源版本').locator('option')).toHaveCount(2);await page.getByLabel('Office 操作来源版本').selectOption('v1');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出该版本PDF'}).click();expect((await download).suggestedFilename()).toBe('Synthetic-v1.pdf');
 expect(await page.evaluate(()=>window.calls.find(x=>x.url.endsWith('/export/pdf')).data.versionId)).toBe('v1');
 await page.getByLabel('Office 副本名称').fill('Private copy');await page.getByRole('button',{name:'另存为私有副本'}).click();await expect(page.getByRole('status')).toContainText('操作失败');
 await page.getByRole('button',{name:'另存为私有副本'}).click();await expect.poll(()=>page.evaluate(()=>window.copied)).toBe('new-private-copy');
 const ids=await page.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/copy')).map(c=>c.data.requestId));expect(ids[0]).toBe(ids[1]);
 await page.evaluate(()=>window.root.render(window.React.createElement(window.Component,{...window.props,role:'VIEWER'})));
 await expect(page.getByRole('button',{name:'重命名文件',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'另存为私有副本'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'导出该版本PDF'})).toBeVisible();
});
