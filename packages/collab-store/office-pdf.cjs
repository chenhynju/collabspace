const {StoreError}=require('./index.cjs');
const {createHash}=require('node:crypto');
const fail=(status,code)=>{throw new StoreError(status,code)};
// ONLYOFFICE 10+: upload a server-authorized immutable snapshot; no client URLs/SSRF.
async function convertPdf({bytes,extension,title,versionId,org,id,internalUrl,signToken}){
 const params={operation:'converter',filetype:extension,outputtype:'pdf',async:false,title,
  key:createHash('sha256').update(org+':'+id+':'+versionId+':pdf:'+createHash('sha256').update(bytes).digest('hex')).digest('hex'),
  exp:Math.floor(Date.now()/1000)+60};
 const form=new FormData();form.append('token',signToken(params));
 form.append('file',new Blob([bytes],{type:'application/octet-stream'}),'source.'+extension);
 let response;
 try{response=await fetch(new URL('/converter/from-file',internalUrl),{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{fail(502,'OFFICE_EXPORT_UNAVAILABLE')}
 if(!response.ok||!response.body)fail(502,'OFFICE_EXPORT_UNAVAILABLE');
 let size=0;const parts=[];
 try{for await(const part of response.body){size+=part.length;if(size>20*1024*1024)fail(413,'OFFICE_EXPORT_SIZE');parts.push(part);}}
 catch(e){if(e instanceof StoreError)throw e;fail(502,'OFFICE_EXPORT_UNAVAILABLE')}
 const result=Buffer.concat(parts);
 if(result.subarray(0,5).toString()!=='%PDF-'||!result.subarray(-1024).includes(Buffer.from('%%EOF')))fail(502,'OFFICE_EXPORT_INVALID');
 return result;
}
module.exports={convertPdf};
