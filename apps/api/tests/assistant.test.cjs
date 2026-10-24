const {test}=require('node:test'), assert=require('node:assert/strict');
const {AssistantService}=require('../dist/modules/assistant/assistant.service');
const {AssistantController}=require('../dist/modules/assistant/assistant.controller');
const {createRequire}=require('node:module');
const JSZip=createRequire(require.resolve('mammoth'))('jszip');
const source='Synthetic meeting: Alice owns delivery on Friday. Risk: test coverage pending. '.repeat(100);
test('bounded generation, scope-separated cache, modes, usage, rate limit and upstream recovery',async()=>{
 const fetchBefore=global.fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='synthetic-test-key';
 const calls=[];global.fetch=async(url,options)=>{calls.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({choices:[{message:{content:'Synthetic summary'}}],usage:{total_tokens:123}})};};
 try{
  const s=new AssistantService();
  const r=await s.generate('orgA:user:project',source,'summary');assert.equal(r.truncated,true);assert.equal(r.usage.total_tokens,123);assert.equal(calls[0].messages[1].content.length,6000);assert.equal(calls[0].max_tokens,700);assert.equal(calls[0].model,'deepseek-chat');
  assert.equal((await s.generate('orgA:user:project',source,'summary')).cached,true);assert.equal(calls.length,1);
  await s.generate('orgB:user:project',source,'summary');assert.equal(calls.length,2);
  await s.generate('orgA:user:project',source,'actions');await s.generate('orgA:user:project',source,'email');assert.equal(calls.length,4);
  await assert.rejects(s.generate('scope','short','summary'),e=>e.getStatus()===400);
  await assert.rejects(s.generate('scope',source,'execute'),e=>e.getStatus()===400);
  global.fetch=async()=>({ok:false,status:429});await assert.rejects(s.generate('failed',source,'summary'),e=>e.getStatus()===502);
  global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'Recovered'}}]})});assert.equal((await s.generate('failed',source,'summary')).text,'Recovered');
  for(let i=0;i<10;i++)await s.generate('budget',i+source,'summary');
  await assert.rejects(s.generate('budget','extra'+source,'summary'),e=>e.getStatus()===429);
  delete process.env.DEEPSEEK_API_KEY;await assert.rejects(s.generate('missing',source,'summary'),e=>e.getStatus()===503);
 }finally{global.fetch=fetchBefore;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});
test('concurrent duplicate is refused without a second paid call; lock releases on failure',async()=>{
 const old=global.fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='test';let release;
 global.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:false});});
 try{const s=new AssistantService(),first=s.generate('scope',source,'summary');await assert.rejects(s.generate('scope',source,'summary'),e=>e.getStatus()===429);release();await assert.rejects(first,e=>e.getStatus()===502);assert.equal(s.busy.size,0);}finally{global.fetch=old;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});
test('both translation directions preserve source, share budget, reject oversized input and report incomplete output',async()=>{
 const old=global.fetch,key=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='test';const calls=[];
 global.fetch=async(url,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,json:async()=>({choices:[{message:{content:'Translated fixture'},finish_reason:'length'}]})};};
 try{const s=new AssistantService();const en=await s.generate('org:user:p1','请周五交付。','translate-en','org:user');assert.match(calls[0].messages[0].content,/English/);assert.equal(calls[0].max_tokens,1200);assert.equal(en.incomplete,true);
  await s.generate('org:user:p2','Please deliver Friday.','translate-zh','org:user');assert.match(calls[1].messages[0].content,/Simplified Chinese/);
  assert.equal((await s.generate('org:user:p2','Please deliver Friday.','translate-zh','org:user')).cached,true);assert.equal(calls.length,2);
  await assert.rejects(s.generate('org:user:p1','长'.repeat(1201),'translate-en','org:user'),e=>e.getStatus()===400);assert.equal(calls.length,2);
  assert.equal(s.budgets.get('org:user').count,2);
 }finally{global.fetch=old;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});
function controller(){
 const checks=[],logs=[];let denied=false;
 const prisma={withOrg:async(org,fn)=>{checks.push(org);return fn({});}};
 const policy={assert:async(...args)=>{checks.push(args.slice(1));if(denied)throw Object.assign(Error('denied'),{status:404});}};
 const ai={generate:async()=>({text:'Synthetic',cached:false})};
 const c=new AssistantController(prisma,policy,ai,{record:async(tx,entry)=>logs.push(entry)});
 return {c,checks,logs,deny:()=>denied=true};
}
const org={organizationId:'server-verified-org'},user={id:'current-user'};
test('authorization before external generation and after completion, no source in audit',async()=>{
 const {c,checks,logs,deny}=controller();
 await c.generate(org,user,{projectId:'project',text:source,mode:'summary',organizationId:'forged'},{traceId:'test-trace'});
 assert.equal(checks.filter(v=>Array.isArray(v)).length,2);assert.deepEqual(checks[1],['server-verified-org','current-user','project','READ']);
 assert.equal(logs[0].traceId,'test-trace');assert.ok(!JSON.stringify(logs).includes(source));
 deny();await assert.rejects(c.generate(org,user,{projectId:'foreign',text:source,mode:'summary'},{traceId:'test'}),/denied/);
});
test('real DOCX and text parser, invalid file refusal, no attachment persistence',async()=>{
 const {c,deny}=controller();const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+source.slice(0,200)+'</w:t></w:r></w:p></w:body></w:document>');
 const buffer=await zip.generateAsync({type:'nodebuffer'});
 const d=await c.extract(org,user,'project',{originalname:'meeting.docx',buffer});assert.match(d.text,/Alice owns delivery/);assert.equal(d.persisted,false);
 const t=await c.extract(org,user,'project',{originalname:'meeting.md',buffer:Buffer.from(source)});assert.match(t.text,/Alice owns delivery/);
 await assert.rejects(c.extract(org,user,'project',{originalname:'bad.pdf',buffer:Buffer.from('invalid')}),e=>e.getStatus()===400);
 await assert.rejects(c.extract(org,user,'project',{originalname:'empty.txt',buffer:Buffer.alloc(0)}),e=>e.getStatus()===400);
 deny();await assert.rejects(c.extract(org,user,'foreign',{originalname:'meeting.docx',buffer}),/denied/);
});
function pdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const text='BT /F1 12 Tf 40 700 Td (Synthetic meeting. Alice owns delivery Friday. Pending test coverage is a risk.) Tj ET';
 objects.push(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
 objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
 let out='%PDF-1.4\n',offset=[0];objects.forEach((o,i)=>{offset.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(out);
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offset.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
test('real synthetic PDF parsing and inflated ZIP rejection',async()=>{
 const {c}=controller();const r=await c.extract(org,user,'project',{originalname:'meeting.pdf',buffer:pdf()});assert.match(r.text,/Alice owns delivery/);
 const malicious=Buffer.alloc(60);malicious.write('PK');malicious.writeUInt32LE(0x02014b50,4);malicious.writeUInt32LE(30*1024*1024,28);
 await assert.rejects(c.extract(org,user,'project',{originalname:'oversized.docx',buffer:malicious}),e=>e.getStatus()===400);
});
