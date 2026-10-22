function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportDiagram(svg:string,format:'svg'|'png'){
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),root=doc.documentElement;
 if(root.tagName!=='svg'||doc.querySelector('parsererror'))throw Error('图表还未完成渲染。');
 // The downloaded file must remain inert outside the preview sandbox too.
 root.querySelectorAll('script,foreignObject').forEach(node=>node.remove());
 for(const node of [root,...Array.from(root.querySelectorAll('*'))])for(const attr of Array.from(node.attributes))if(/^on/i.test(attr.name)||(/(?:^|:)href$/i.test(attr.name)&&!attr.value.startsWith('#')))node.removeAttributeNode(attr);
 const box=(root.getAttribute('viewBox')||'0 0 1200 800').split(/[ ,]+/).map(Number),w=box[2],h=box[3];
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw Error('图表尺寸无效。');
 const ratio=Math.min(2,4096/w,4096/h),width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
 root.setAttribute('xmlns','http://www.w3.org/2000/svg');root.setAttribute('width',String(format==='png'?width:w));root.setAttribute('height',String(format==='png'?height:h));root.style.maxWidth='none';
 const blob=new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml;charset=utf-8'});
 if(format==='svg'){download(blob,'collabspace-diagram.svg');return;}
 const url=URL.createObjectURL(blob);
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('图片导出失败，请下载SVG。'));image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器不支持图片导出。');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片编码失败。')),'image/png'));download(png,'collabspace-diagram.png');
 }finally{URL.revokeObjectURL(url);}
}
