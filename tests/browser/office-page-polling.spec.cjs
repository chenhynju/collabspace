const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const web=createRequire(path.resolve('apps/web/package.json')),ts=web('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
test('Office page polling keeps exactly one actions panel and one image preparation panel',async({page})=>{
 await page.route('http://localhost/office-polling-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('http://localhost/office-polling-test');
 for(const name of ['react','react-dom'])await page.addScriptTag({path:path.join(path.dirname(web.resolve(name+'/package.json')),'umd',name+'.development.js')});
 await page.evaluate(sources=>{
  window.polls=0;
  const state={title:'Synthetic.docx',role:'EDITOR',revision:1,generation:'g',phase:'OPEN',versions:[{id:'v1',revision:1}],users:[]};
  const api={get:async()=>{window.polls++;return {data:state}},post:async()=>({data:{sessionId:'synthetic-session',role:'EDITOR',publicUrl:'http://localhost',config:{}}})};
  window.DocsAPI={DocEditor:function(id,config){this.destroyEditor=()=>{};queueMicrotask(()=>config.events.onDocumentReady());}};
  const interval=window.setInterval;window.setInterval=(callback,ms)=>interval(callback,ms===2000?30:ms);
  const modules={'lucide-react':{UploadCloud:()=>null,FileCheck2:()=>null},'react':window.React,'@/lib/api':{api},'@/lib/prepare-office-image':{prepareOfficeImage:async f=>f},'next/link':{default:props=>window.React.createElement('a',props)},'next/navigation':{useRouter:()=>({push:()=>{}})},'@/lib/display-date':{displayDate:()=>''},'@/store/auth':{useAuthStore:selector=>selector({currentOrgId:'synthetic-org'})}};
  const load=(name,code)=>{const exports={};new Function('exports','require','React',code)(exports,n=>modules[n],window.React);modules[name]=exports;return exports};
  load('@/components/file-picker',sources.picker);load('@/components/office-file-actions',sources.actions);load('@/components/office-image-preparation',sources.images);
  const Page=load('page',sources.page).default,root=document.createElement('div');document.body.append(root);window.ReactDOM.createRoot(root).render(window.React.createElement(Page,{params:{id:'synthetic-document'}}));
 },{picker:compile('apps/web/src/components/file-picker.tsx'),actions:compile('apps/web/src/components/office-file-actions.tsx'),images:compile('apps/web/src/components/office-image-preparation.tsx'),page:compile('apps/web/src/app/(app)/office/[id]/page.tsx')});
 await expect.poll(()=>page.evaluate(()=>window.polls)).toBeGreaterThanOrEqual(10);
 await expect(page.locator('[data-office-ready="true"]')).toHaveCount(1);
 await expect(page.locator('[data-office-file-actions]')).toHaveCount(1);
 await expect(page.getByText('图片上传慢？先缩小图片',{exact:true})).toHaveCount(1);
});
