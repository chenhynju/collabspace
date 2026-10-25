const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const web=createRequire(path.resolve('apps/web/package.json')),ts=web('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
test('local image preparation: original, transparency, reduced bytes, preview and downloadable file',async({page})=>{
  await page.goto('about:blank');
  for(const name of ['react','react-dom'])await page.addScriptTag({path:path.join(path.dirname(web.resolve(name+'/package.json')),'umd',name+'.development.js')});
  await page.evaluate(source=>{const exports={};new Function('exports',source)(exports);window.imagePreparation=exports;},compile('apps/web/src/lib/prepare-office-image.ts'));
  const result=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1600;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#123abc';ctx.fillRect(100,100,2200,1400);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const file=new File([blob],'diagram.png',{type:'image/png'}),prepare=window.imagePreparation.prepareOfficeImage;
    const original=await prepare(file,'original'),small=await prepare(file,'small');
    const bitmap=await createImageBitmap(small);const check=document.createElement('canvas');check.width=bitmap.width;check.height=bitmap.height;
    const c=check.getContext('2d');c.drawImage(bitmap,0,0);const alpha=c.getImageData(0,0,1,1).data[3];bitmap.close();
    let rejected=false;try{await prepare(new File(['svg'],'x.svg',{type:'image/svg+xml'}),'small');}catch{rejected=true;}
    const animated=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,8,97,99,84,76,0,0,0,1,0,0,0,0]);
    let animationRejected=false;try{await prepare(new File([animated],'animated.png',{type:'image/png'}),'small');}catch(e){animationRejected=e.message.includes('动画');}
    const one=document.createElement('canvas');one.width=one.height=1;
    const oneBlob=await new Promise(r=>one.toBlob(r,'image/png')),oneFile=new File([oneBlob],'one.png',{type:'image/png'});
    const kept=(await prepare(oneFile,'balanced'))===oneFile;
    const tiny=new File([new Uint8Array([1,2,3])],'tiny.png',{type:'image/png'});
    window.fixture=file;
    return {same:original===file,bytes:small.size,original:file.size,width:check.width,height:check.height,alpha,rejected,animationRejected,kept,tinyOriginal:(await prepare(tiny,'original'))===tiny};
  });
  expect(result.same).toBe(true);expect(result.tinyOriginal).toBe(true);expect(result.rejected).toBe(true);
  expect(result.animationRejected).toBe(true);expect(result.kept).toBe(true);
  expect(result.bytes).toBeLessThan(result.original);expect(result.width).toBe(1280);expect(result.height).toBe(853);expect(result.alpha).toBe(0);
  await page.evaluate(source=>{const exports={};new Function('exports','require','React',source)(exports,name=>name==='react'?window.React:{UploadCloud:()=>null,FileCheck2:()=>null},window.React);window.filePicker=exports;},compile('apps/web/src/components/file-picker.tsx'));
  await page.evaluate(source=>{
    const exports={},require=name=>name==='react'?window.React:name==='@/components/file-picker'?window.filePicker:window.imagePreparation;
    new Function('exports','require','React',source)(exports,require,window.React);
    const root=document.createElement('div');document.body.append(root);window.ReactDOM.createRoot(root).render(window.React.createElement(exports.OfficeImagePreparation));
  },compile('apps/web/src/components/office-image-preparation.tsx'));
  await page.getByText('图片上传慢？先缩小图片',{exact:true}).click();
  await page.getByLabel('准备插入的图片').evaluate(input=>{const dt=new DataTransfer();dt.items.add(window.fixture);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.getByLabel('图片质量').selectOption('small');await page.getByRole('button',{name:'生成预览'}).click();
  await expect(page.getByRole('img',{name:'待插入图片预览'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('减少');
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'下载待插入图片'}).click();
  expect((await download).suggestedFilename()).toBe('diagram-optimized.webp');
  await page.getByLabel('图片质量').selectOption('original');await expect(page.getByRole('link',{name:'下载待插入图片'})).toHaveCount(0);
  await page.getByRole('button',{name:'生成预览'}).click();await expect(page.getByRole('status')).toContainText('保持原图');
});
