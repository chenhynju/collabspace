// Explicit synthetic-only real engine check. Never loads production credentials itself.
const fs=require('node:fs'),path=require('node:path');
const {convertPdf}=require('../packages/collab-store/office-pdf.cjs'),{sign}=require('../packages/collab-store/office.cjs');
if(process.env.OFFICE_PDF_ENGINE_TEST!=='1'||!process.env.OFFICE_TEST_ENGINE_URL||!process.env.OFFICE_TEST_JWT_SECRET)throw Error('Explicit engine test URL, test flag and private JWT secret required');
(async()=>{
 const out=path.resolve('.test-runs/office-product-real-pdf');fs.mkdirSync(out,{recursive:true});
 for(const extension of ['docx','xlsx','pptx']){
  const bytes=await convertPdf({bytes:fs.readFileSync('.test-runs/office/fixtures/baseline.'+extension),extension,title:'Synthetic baseline.'+extension,versionId:'synthetic-v1',org:'synthetic',id:'synthetic-'+extension,internalUrl:process.env.OFFICE_TEST_ENGINE_URL,signToken:payload=>sign(payload,process.env.OFFICE_TEST_JWT_SECRET)});
  fs.writeFileSync(path.join(out,extension+'.pdf'),bytes);console.log(extension,bytes.length,'PDF bytes');
 }
})().catch(e=>{console.error('Synthetic PDF conversion failed: '+(e.code||'UNAVAILABLE'));process.exitCode=1;});
