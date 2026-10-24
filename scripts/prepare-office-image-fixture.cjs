// Generate the comparison file using exactly the browser implementation used by the UI.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {chromium}=require('@playwright/test'),web=createRequire(path.resolve('apps/web/package.json')),ts=web('typescript');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();await page.goto('about:blank');
  const source=ts.transpileModule(fs.readFileSync('apps/web/src/lib/prepare-office-image.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const input=fs.readFileSync('.test-runs/ppt-image-profile/large.png');
  const result=await page.evaluate(async({source,base64})=>{
   const exports={};new Function('exports',source)(exports);
   const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'large.png',{type:'image/png'});
   const begin=performance.now(),output=await exports.prepareOfficeImage(file,'small');
   const timeMs=performance.now()-begin,bitmap=await createImageBitmap(output),width=bitmap.width,height=bitmap.height;bitmap.close();
   return {bytes:Array.from(new Uint8Array(await output.arrayBuffer())),timeMs,width,height,type:output.type};
  },{source,base64:input.toString('base64')});
  if(result.type!=='image/webp')throw Error('Expected smaller WebP fixture');
  fs.writeFileSync('.test-runs/ppt-image-profile/large-optimized.webp',Buffer.from(result.bytes));
  const report={inputBytes:input.length,outputBytes:result.bytes.length,timeMs:result.timeMs,width:result.width,height:result.height};
  fs.writeFileSync('.test-runs/ppt-image-profile/preparation.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
