const {Store,StoreError}=require('./index.cjs');
const {randomUUID,createHash,createHmac,timingSafeEqual}=require('node:crypto');
const {unzipSync}=require('fflate');
const fs=require('node:fs'),path=require('node:path');
const fail=(status,code)=>{throw new StoreError(status,code)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function sign(payload,secret){const s=b64({alg:'HS256',typ:'JWT'})+'.'+b64(payload);return s+'.'+createHmac('sha256',secret).update(s).digest('base64url')}
function verify(token,secret){
 if(typeof token!=='string'||token.length>100000)fail(401,'OFFICE_SIGNATURE');
 const [a,b,c,...extra]=token.split('.');if(!a||!b||!c||extra.length)fail(401,'OFFICE_SIGNATURE');
 const expected=createHmac('sha256',secret).update(a+'.'+b).digest('base64url');
 if(expected.length!==c.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(c)))fail(401,'OFFICE_SIGNATURE');
 const header=JSON.parse(Buffer.from(a,'base64url')),p=JSON.parse(Buffer.from(b,'base64url'));
 if(header.alg!=='HS256'||!p||typeof p!=='object'||(p.exp&&p.exp<Date.now()/1000))fail(401,'OFFICE_SIGNATURE');return p;
}
function validate(bytes,ext){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>20*1024*1024)fail(413,'OFFICE_SIZE');
 let total=0,count=0,files;
 try{files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;count++;if(total>60*1024*1024||count>5000||/vbaProject/i.test(f.name)||f.name.startsWith('/')||f.name.split('/').includes('..'))throw Error('unsafe archive');return true}})}catch{fail(400,'OFFICE_INVALID_ARCHIVE')}
 const root={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'}[ext];
 if(!root||!files[root]||!files['[Content_Types].xml'])fail(400,'OFFICE_FORMAT');
 // Reject external resource relationships, rather than letting an uploaded file fetch internal URLs.
 for(const [name,data] of Object.entries(files))if(name.endsWith('.rels')&&/TargetMode\s*=\s*["']External["']/i.test(Buffer.from(data).toString('utf8')))fail(400,'OFFICE_EXTERNAL_RESOURCE');
 return bytes;
}
class OfficeStore extends Store{
 constructor(url,options={}){super(url);this.options=options;this.registry=new Map();this.timer=null;this.busy=false;this.pendingDrops=new Set();this.dropped=new Set();this.exportJobs=new Set()}
 setting(key){return this.options[key]??process.env[key]}
 enabled(){return !!(this.setting('OFFICE_PUBLIC_URL')&&this.setting('OFFICE_INTERNAL_URL')&&this.setting('OFFICE_JWT_SECRET')&&this.setting('OFFICE_CAPABILITY_SECRET'))}
 async assertOfficeRuntime(){
  await this.assertRuntime();
  const r=await this.pool.query("SELECT count(*)::int AS count FROM pg_class WHERE relname=ANY($1::text[]) AND relrowsecurity AND relforcerowsecurity AND relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)",[['collab_office','collab_office_version','collab_office_lease']]);
  if(r.rows[0].count!==3)throw Error('Office migration and FORCE RLS required');
  await this.pool.query('SELECT activity_epoch FROM collab_office LIMIT 0');
  await this.pool.query('SELECT id,active_epoch FROM collab_office_lease LIMIT 0');
  if(process.env.NODE_ENV==='production'&&this.enabled()&&!this.setting('OFFICE_REGISTRY_FILE'))throw Error('Durable Office monitor registry required');
 }
 key(ctx,id,h){return hash(ctx.org+':'+id+':'+h.generation)}
 capability(ctx,id,h,purpose,user,session){return sign({org:ctx.org,id,generation:h.generation,purpose,user,session,exp:Math.floor(Date.now()/1000)+(purpose==='callback'?86400:300)},this.setting('OFFICE_CAPABILITY_SECRET'))}
 claim(token,purpose){const p=verify(token,this.setting('OFFICE_CAPABILITY_SECRET'));if(p.purpose!==purpose||typeof p.org!=='string'||typeof p.id!=='string'||typeof p.user!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(p.session||''))fail(401,'OFFICE_CAPABILITY');return p}
 async head(c,ctx,id){const h=(await c.query('SELECT * FROM collab_office WHERE organization_id=$1 AND document_id=$2 FOR UPDATE',[ctx.org,id])).rows[0];if(!h)fail(404,'NOT_FOUND');return h}
 async createBlank(ctx,project,input){
  if(!this.enabled())fail(503,'OFFICE_NOT_CONFIGURED');
  const ext=input?.extension,name=typeof input?.title==='string'?input.title.trim().replace(/\.(docx|xlsx|pptx)$/i,''):'';
  if(!['docx','xlsx','pptx'].includes(ext)||!name||name.length>150||/[\x00-\x1f\\/]/.test(name)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input?.requestId||''))fail(400,'OFFICE_CREATE_INVALID');
  const title=name+'.'+ext,fileId='blank_'+hash(Buffer.from(ctx.org+':'+input.requestId));
  try{return await this.tx(ctx,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['office:create:'+ctx.org+':'+input.requestId]);
   const {p}=await this.parent(c,ctx,project);
   if(p.access==='READ')fail(403,'READ_ONLY');if(p.status==='ARCHIVED')fail(409,'PROJECT_ARCHIVED');
   const prior=(await c.query('SELECT f.*,o.document_id FROM prj_file f LEFT JOIN collab_office o ON o.organization_id=f.organization_id AND o.file_id=f.id WHERE f.organization_id=$1 AND f.id=$2',[ctx.org,fileId])).rows[0];
   if(prior){if(prior.project_id!==project||prior.name!==title||prior.uploaded_by!==ctx.user||!prior.document_id)fail(409,'OFFICE_CREATE_CONFLICT');await this.access(c,ctx,prior.document_id);return {id:prior.document_id,fileId,replayed:true};}
   const bytes=validate(fs.readFileSync(path.join(__dirname,'templates','blank.'+ext)),ext);
   const root=path.resolve(this.setting('UPLOAD_ROOT')||'.uploads'),object=ctx.org+'/'+project+'/'+randomUUID(),target=path.resolve(root,object);
   if(!target.startsWith(root+path.sep))fail(400,'OFFICE_OBJECT_KEY');
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
   const mime='application/vnd.openxmlformats-officedocument.'+({docx:'wordprocessingml.document',xlsx:'spreadsheetml.sheet',pptx:'presentationml.presentation'}[ext]);
   await c.query('INSERT INTO prj_file(id,organization_id,project_id,name,object_key,size,mime_type,version,uploaded_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,now())',[fileId,ctx.org,project,title,object,bytes.length,mime,ctx.user]);
   const doc=await this.insert(c,ctx,project,title,undefined,'OFFICE'),generation=randomUUID();
   await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,$4,$5,'CLOSED')",[ctx.org,doc.id,fileId,ext,generation]);
   await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,doc.id,randomUUID(),generation,'blank',bytes]);
   await this.audit(c,ctx,doc.id,'office:create',null,{fileId,extension:ext,title});return {id:doc.id,fileId};
  });}catch(e){if(e.code==='23505')fail(409,'OFFICE_CREATE_CONFLICT');throw e;}
 }
 async importFile(ctx,fileId){
  if(!this.enabled())fail(503,'OFFICE_NOT_CONFIGURED');
  return this.tx(ctx,async c=>{
   const f=(await c.query('SELECT * FROM prj_file WHERE organization_id=$1 AND id=$2 FOR SHARE',[ctx.org,fileId])).rows[0];if(!f)fail(404,'NOT_FOUND');
   const parent=await this.parent(c,ctx,f.project_id);
   // A project lock serializes duplicate first-open initialization.
   await c.query('SELECT id FROM prj_project WHERE organization_id=$1 AND id=$2 FOR UPDATE',[ctx.org,f.project_id]);
   const old=(await c.query('SELECT document_id FROM collab_office WHERE organization_id=$1 AND file_id=$2',[ctx.org,fileId])).rows[0];
   if(old){await this.access(c,ctx,old.document_id);return {id:old.document_id}}
   if(f.uploaded_by!==ctx.user)fail(403,'UPLOADER_REQUIRED');
   if(parent.p.access==='READ')fail(403,'READ_ONLY');
   const ext=path.extname(f.name).slice(1).toLowerCase();
   const root=path.resolve(this.setting('UPLOAD_ROOT')||'.uploads'),file=path.resolve(root,f.object_key);
   if(!file.startsWith(root+path.sep))fail(400,'OFFICE_OBJECT_KEY');
   const name=path.basename(f.name,path.extname(f.name)).slice(0,154)+'.'+ext;
   const bytes=validate(fs.readFileSync(file),ext),doc=await this.insert(c,ctx,f.project_id,name,undefined,'OFFICE'),generation=randomUUID();
   await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,$4,$5,'CLOSED')",[ctx.org,doc.id,fileId,ext,generation]);
   await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,doc.id,randomUUID(),generation,'original',bytes]);return {id:doc.id};
  });
 }
 remember(ctx,id){
  this.registry.set(ctx.org+':'+id,{org:ctx.org,id});
  const target=this.setting('OFFICE_REGISTRY_FILE');
  if(target){fs.mkdirSync(path.dirname(target),{recursive:true});const temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify([...this.registry.values()]),{mode:0o600});fs.renameSync(temp,target)}
 }
 start(){
  const file=this.setting('OFFICE_REGISTRY_FILE');if(file&&fs.existsSync(file))for(const v of JSON.parse(fs.readFileSync(file)))this.registry.set(v.org+':'+v.id,v);
  this.timer=setInterval(()=>{if(!this.busy){this.busy=true;this.monitor().catch(()=>{}).finally(()=>this.busy=false)}},2000);this.timer.unref();
 }
 async close(){if(this.timer)clearInterval(this.timer);while(this.busy)await new Promise(r=>setTimeout(r,50));await super.close()}
 async config(ctx,id){
  if(!this.enabled())fail(503,'OFFICE_NOT_CONFIGURED');
  const result=await this.tx(ctx,async c=>{
   const d=await this.access(c,ctx,id),h=await this.head(c,ctx,id);if(h.phase==='FROZEN')fail(409,'OFFICE_RECOVERY_REQUIRED');if(h.phase==='CLOSING')fail(409,'OFFICE_CLOSING');
   if(h.phase==='CLOSED'){h.generation=randomUUID();h.phase='OPEN';h.activity_epoch=0;await c.query("UPDATE collab_office SET generation=$3,phase='OPEN',users='[]',issued=0,saved=0,activity_epoch=0,error=NULL WHERE organization_id=$1 AND document_id=$2",[ctx.org,id,h.generation])}
   const edit=['OWNER','EDITOR'].includes(d.role);
   const active=(await c.query('SELECT count(*)::int AS n FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND generation=$3 AND expires_at>now()',[ctx.org,id,h.generation])).rows[0].n;if(active>=50)fail(429,'OFFICE_SESSION_LIMIT');
   const session=randomUUID();
   await c.query("INSERT INTO collab_office_lease(organization_id,document_id,user_id,generation,role,expires_at,id,active_epoch) VALUES($1,$2,$3,$4,$5,now()+interval '90 seconds',$6,0)",[ctx.org,id,ctx.user,h.generation,d.role,session]);
   const base=this.setting('OFFICE_CALLBACK_BASE')||process.env.APP_URL+'/api/v1';
   const config={documentType:{docx:'word',xlsx:'cell',pptx:'slide'}[h.extension],document:{title:d.title,fileType:h.extension,key:this.key(ctx,id,h),url:base+'/office/engine/file?cap='+this.capability(ctx,id,h,'read',ctx.user,session),permissions:{edit,download:false,print:false,comment:edit}},editorConfig:{mode:edit?'edit':'view',lang:'zh',user:{id:session,name:d.userName},callbackUrl:base+'/office/engine/callback?cap='+this.capability(ctx,id,h,'callback',ctx.user,session),coEditing:{mode:'fast',change:false},customization:{forcesave:false}},width:'100%',height:'100%'};
   return {id,sessionId:session,title:d.title,role:d.role,publicUrl:this.setting('OFFICE_PUBLIC_URL'),config:{...config,token:sign({...config,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+900},this.setting('OFFICE_JWT_SECRET'))}};
  });this.remember(ctx,id);return result;
 }
 async heartbeat(ctx,id,session){return this.tx(ctx,async c=>{
  const d=await this.access(c,ctx,id),h=await this.head(c,ctx,id);
  if(session&&/^[0-9a-f-]{36}$/i.test(session))await c.query("UPDATE collab_office_lease SET expires_at=now()+interval '90 seconds' WHERE organization_id=$1 AND document_id=$2 AND user_id=$3 AND role=$4 AND generation=$5 AND id=$6",[ctx.org,id,ctx.user,d.role,h.generation,session]);
  const users=[];for(const sid of h.phase==='OPEN'?h.users:[]){const found=(await c.query('SELECT u.id,u.name FROM collab_office_lease l JOIN sys_user u ON u.id=l.user_id WHERE l.organization_id=$1 AND l.document_id=$2 AND l.id=$3',[ctx.org,id,sid])).rows[0];if(found&&!users.some(u=>u.id===found.id))users.push(found)}
  const versions=(await c.query("SELECT id,revision,created_at FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND (revision IS NOT NULL OR $3='OWNER') ORDER BY created_at DESC LIMIT 50",[ctx.org,id,d.role])).rows;
  return {id,projectId:d.project_id,title:d.title,extension:h.extension,role:d.role,revision:h.revision,generation:h.generation,phase:h.phase,error:h.error,users,versions};
 })}
 async leaseCheck(c,ctx,id,h){
  const leases=(await c.query('SELECT * FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND generation=$3 ORDER BY user_id,id',[ctx.org,id,h.generation])).rows;
  for(const l of leases){try{const d=await this.access(c,{org:ctx.org,user:l.user_id},id);if(d.role!==l.role||(h.users.includes(l.id)&&new Date(l.expires_at)<new Date()))return false}catch(e){if([403,404,409].includes(e.status))return false;throw e}}
  return leases.length>0;
 }
 async command(body){const url=new URL('/command',this.setting('OFFICE_INTERNAL_URL'));const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token:sign(body,this.setting('OFFICE_JWT_SECRET'))}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)fail(502,'OFFICE_COMMAND');return r.json()}
 async monitor(){for(const key of this.pendingDrops){try{const r=await this.command({c:'drop',key});if([0,1].includes(r.error)){this.pendingDrops.delete(key);this.dropped.add(key)}}catch{}}
 for(const {org,id} of this.registry.values()){
  const ctx={org,user:'office-monitor'};let drop;
  await this.tx(ctx,async c=>{const ref=(await c.query('SELECT created_by FROM collab_document WHERE organization_id=$1 AND id=$2',[org,id])).rows[0];if(!ref)return;
   // All ACL-sensitive operations lock the document before the Office head.
   await c.query('SELECT id FROM collab_document WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,id]);const h=await this.head(c,ctx,id);
   if(h.phase==='OPEN'&&!h.users.length){const live=(await c.query('SELECT count(*)::int AS n FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND generation=$3 AND expires_at>now()',[org,id,h.generation])).rows[0].n;if(!live){await c.query("UPDATE collab_office SET phase='CLOSED' WHERE organization_id=$1 AND document_id=$2",[org,id]);h.phase='CLOSED'}}
   if(h.phase==='OPEN'&&!await this.leaseCheck(c,ctx,id,h)){await c.query("UPDATE collab_office SET phase='FROZEN',error='ACCESS_CHANGED_OR_LEASE_EXPIRED' WHERE organization_id=$1 AND document_id=$2",[org,id]);h.phase='FROZEN'}
   if(h.phase==='OPEN'&&h.issued>h.saved&&Date.now()-new Date(h.updated_at).getTime()>90000){await c.query("UPDATE collab_office SET phase='FROZEN',error='SAVE_ACK_TIMEOUT' WHERE organization_id=$1 AND document_id=$2",[org,id]);h.phase='FROZEN'}
   if(h.phase==='CLOSING'&&Date.now()-new Date(h.updated_at).getTime()>90000){await c.query("UPDATE collab_office SET phase='FROZEN',error='FINAL_SAVE_ACK_TIMEOUT' WHERE organization_id=$1 AND document_id=$2",[org,id]);h.phase='FROZEN'}
   if(h.phase==='FROZEN'&&!this.dropped.has(this.key(ctx,id,h)))drop={c:'drop',key:this.key(ctx,id,h)};
  });if(drop)try{const r=await this.command(drop);if([0,1].includes(r.error))this.dropped.add(drop.key)}catch{}
 }}
 async force(ctx,id){const body=await this.tx(ctx,async c=>{await this.access(c,ctx,id,'write');const h=await this.head(c,ctx,id);if(h.phase!=='OPEN'||!await this.leaseCheck(c,ctx,id,h))fail(409,'OFFICE_RECOVERY_REQUIRED');if(h.issued>h.saved)fail(409,'OFFICE_SAVE_PENDING');const seq=h.issued+1;await c.query('UPDATE collab_office SET issued=$3,updated_at=now() WHERE organization_id=$1 AND document_id=$2',[ctx.org,id,seq]);return {c:'forcesave',key:this.key(ctx,id,h),userdata:h.generation+':'+seq}});
  const [generation,sequence]=body.userdata.split(':');
  try{const result=await this.command(body);if(result.error!==0)await this.tx(ctx,c=>c.query('UPDATE collab_office SET issued=saved WHERE organization_id=$1 AND document_id=$2 AND generation=$3 AND issued=$4',[ctx.org,id,generation,Number(sequence)]));return result}
  catch(e){await this.tx(ctx,c=>c.query("UPDATE collab_office SET phase='FROZEN',error='COMMAND_ACK_UNKNOWN' WHERE organization_id=$1 AND document_id=$2 AND generation=$3 AND phase='OPEN' AND issued>saved",[ctx.org,id,generation]));throw e}
 }
 async bytes(ctx,id,version){return this.tx(ctx,async c=>{const d=await this.access(c,ctx,id),h=await this.head(c,ctx,id);const v=(await c.query('SELECT * FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND '+(version?'id=$3':'revision=$3'),[ctx.org,id,version||h.revision])).rows[0];if(!v||(!v.revision&&d.role!=='OWNER'))fail(404,'NOT_FOUND');return {bytes:v.bytes,name:d.title,extension:h.extension}})}
 async fileCurrent(ctx,file){const id=await this.tx(ctx,async c=>(await c.query('SELECT document_id FROM collab_office WHERE organization_id=$1 AND file_id=$2',[ctx.org,file])).rows[0]?.document_id);return id?this.bytes(ctx,id):null}
 async isOfficeFile(org,file){return this.tx({org,user:'office-share-check'},async c=>(await c.query('SELECT document_id FROM collab_office WHERE organization_id=$1 AND file_id=$2',[org,file])).rowCount>0)}
 async shareOffice(ctx,file){return this.tx(ctx,async c=>{const row=(await c.query('SELECT document_id FROM collab_office WHERE organization_id=$1 AND file_id=$2',[ctx.org,file])).rows[0];if(!row)return false;await this.access(c,ctx,row.document_id,'owner');return true})}
 async visibleFiles(ctx,files){return this.tx(ctx,async c=>{
  const maps=(await c.query(`SELECT o.file_id,o.document_id,o.revision,v.created_at AS last_edited_at,a.after_value->'lastEditor' AS last_editor FROM collab_office o JOIN collab_office_version v ON v.organization_id=o.organization_id AND v.document_id=o.document_id AND v.revision=o.revision LEFT JOIN LATERAL (SELECT after_value FROM sys_oper_log WHERE organization_id=o.organization_id AND resource_id=o.document_id AND action='office:save' AND after_value->>'revision'=o.revision::text ORDER BY created_at DESC LIMIT 1) a ON true WHERE o.organization_id=$1 AND o.file_id=ANY($2::text[]) ORDER BY o.document_id`,[ctx.org,files.map(f=>f.id)])).rows,hidden=new Set();
  for(const m of maps)try{await this.access(c,ctx,m.document_id)}catch(e){if([403,404,409].includes(e.status))hidden.add(m.file_id);else throw e}
  const map=new Map(maps.map(m=>[m.file_id,m]));return files.filter(f=>!hidden.has(f.id)).map(f=>{const m=map.get(f.id);return {...f,officeId:m?.document_id,officeRevision:m?.revision,lastEditedAt:m?.last_edited_at,lastEditor:m?.last_editor}});
 })}
 async renameOffice(ctx,id,input){
  return this.tx(ctx,async c=>{
   const d=await this.access(c,ctx,id,'write'),h=await this.head(c,ctx,id);
   const title=this.officeTitle(input?.title,h.extension);
   if(input?.expectedTitle!==d.title)fail(409,'OFFICE_NAME_CONFLICT');
   if(title===d.title)return {title};
   await c.query('UPDATE collab_document SET title=$3,updated_at=now() WHERE organization_id=$1 AND id=$2',[ctx.org,id,title]);
   await c.query('UPDATE prj_file SET name=$3 WHERE organization_id=$1 AND id=$2',[ctx.org,h.file_id,title]);
   await this.audit(c,ctx,id,'office:rename',{titleHash:hash(d.title)},{titleHash:hash(title)});return {title};
  });
 }
 officeTitle(value,extension){
  const name=typeof value==='string'?value.trim():'';
  if(!name||name.length>150||/[\x00-\x1f\x7f\\/\u202a-\u202e\u2066-\u2069]/.test(name))fail(400,'OFFICE_NAME_INVALID');
  if(/\.(docx|xlsx|pptx)$/i.test(name)&&!name.toLowerCase().endsWith('.'+extension))fail(400,'OFFICE_NAME_EXTENSION');
  const base=name.toLowerCase().endsWith('.'+extension)?name.slice(0,-extension.length-1):name;
  if(!base.trim()||base==='.'||base==='..')fail(400,'OFFICE_NAME_INVALID');return base+'.'+extension;
 }
 async exportPdf(ctx,id,versionId){
  if(!this.enabled())fail(503,'OFFICE_NOT_CONFIGURED');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId||''))fail(400,'OFFICE_EXPORT_VERSION');
  const job=ctx.org+':'+ctx.user;if(this.exportJobs.has(job)||this.exportJobs.size>=2)fail(429,'OFFICE_EXPORT_BUSY');this.exportJobs.add(job);
  try{
   const source=await this.tx(ctx,async c=>{
    const d=await this.access(c,ctx,id),h=await this.head(c,ctx,id);
    const v=(await c.query('SELECT bytes,revision FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND id=$3 AND revision IS NOT NULL',[ctx.org,id,versionId])).rows[0];
    if(!v)fail(404,'NOT_FOUND');return {bytes:v.bytes,revision:v.revision,title:d.title,extension:h.extension};
   });
   const {convertPdf}=require('./office-pdf.cjs');
   const bytes=await convertPdf({...source,org:ctx.org,id,versionId,internalUrl:this.setting('OFFICE_INTERNAL_URL'),signToken:p=>sign(p,this.setting('OFFICE_JWT_SECRET'))});
   return await this.tx(ctx,async c=>{
    await this.access(c,ctx,id);
    await this.audit(c,ctx,id,'office:export-pdf',null,{versionId,revision:source.revision,size:bytes.length});
    return {bytes,revision:source.revision,name:source.title.replace(/\.[^.]+$/,'')+'.pdf'};
   });
  }finally{this.exportJobs.delete(job)}
 }
 async copyOffice(ctx,id,input){
  if(!input?.title)fail(400,'OFFICE_NAME_INVALID');
  return this.restoreOffice(ctx,id,input.versionId,input.requestId,input.title);
 }
 async restoreOffice(ctx,id,version,requestId,copyTitle){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(version)||!uuid.test(requestId))fail(400,'OFFICE_RESTORE_ID');
  return this.tx(ctx,async c=>{
   const d=await this.access(c,ctx,id,'write'),h=await this.head(c,ctx,id);
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['office:copy:'+ctx.org+':'+requestId]);
   const requestedTitle=copyTitle===undefined?undefined:this.officeTitle(copyTitle,h.extension);
   const prior=(await c.query('SELECT * FROM collab_restore WHERE organization_id=$1 AND id=$2',[ctx.org,requestId])).rows[0];
   if(prior){if(prior.document_id!==id||prior.version_id!==version||prior.actor_id!==ctx.user)fail(409,'OFFICE_RESTORE_CONFLICT');const result=await this.access(c,ctx,prior.result_id);if(requestedTitle&&result.title!==requestedTitle)fail(409,'OFFICE_RESTORE_CONFLICT');return {id:prior.result_id}}
   const v=(await c.query('SELECT * FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND id=$3',[ctx.org,id,version])).rows[0];if(!v||(!v.revision&&d.role!=='OWNER'))fail(404,'NOT_FOUND');
   if(requestedTitle&&!v.revision)fail(409,'OFFICE_COPY_UNCONFIRMED');
   const fileId=randomUUID(),generation=randomUUID(),name=requestedTitle||('恢复副本-'+requestId.slice(0,8)+'-'+path.basename(d.title,path.extname(d.title))).slice(0,154)+'.'+h.extension;
   const root=path.resolve(this.setting('UPLOAD_ROOT')||'.uploads'),object=ctx.org+'/'+d.project_id+'/'+randomUUID(),target=path.resolve(root,object);
   if(!target.startsWith(root+path.sep))fail(400,'OFFICE_OBJECT_KEY');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,v.bytes,{flag:'wx'});
   await c.query('INSERT INTO prj_file(id,organization_id,project_id,name,object_key,size,mime_type,version,uploaded_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,now())',[fileId,ctx.org,d.project_id,name,object,v.bytes.length,'application/octet-stream',ctx.user]);
   const copy=await this.insert(c,ctx,d.project_id,name,undefined,'OFFICE');
   await c.query("INSERT INTO collab_office(organization_id,document_id,file_id,extension,generation,phase) VALUES($1,$2,$3,$4,$5,'CLOSED')",[ctx.org,copy.id,fileId,h.extension,generation]);
   await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,1,$4,$5,$6,now())',[ctx.org,copy.id,randomUUID(),generation,'restored',v.bytes]);
   await c.query('INSERT INTO collab_restore VALUES($1,$2,$3,$4,$5,$6)',[requestId,ctx.org,id,version,ctx.user,copy.id]);
   await this.audit(c,ctx,id,'office:restore-copy',{versionId:version},{copyId:copy.id});return {id:copy.id};
  });
 }
 async engineFile(token){const claim=this.claim(token,'read'),ctx={org:claim.org,user:claim.user};return this.tx(ctx,async c=>{const d=await this.access(c,ctx,claim.id),h=await this.head(c,ctx,claim.id);if(h.generation!==claim.generation||h.phase!=='OPEN')fail(403,'OFFICE_STALE_SESSION');const lease=(await c.query('SELECT id FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND id=$3 AND user_id=$4 AND generation=$5 AND expires_at>now()',[ctx.org,claim.id,claim.session,ctx.user,h.generation])).rows[0];if(!lease)fail(403,'OFFICE_STALE_SESSION');const v=(await c.query('SELECT bytes FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND revision=$3',[ctx.org,claim.id,h.revision])).rows[0];return {bytes:v.bytes,name:d.title,extension:h.extension}})}
 async candidate(url,ext){
  let u;try{u=new URL(url)}catch{fail(400,'OFFICE_SAVE_URL')}
  const base=new URL(this.setting('OFFICE_INTERNAL_URL'));
  const publicBase=new URL(this.setting('OFFICE_PUBLIC_URL'));
  const source=[publicBase,base].find(b=>u.origin===b.origin&&u.pathname.startsWith(b.pathname.replace(/\/$/,'')+'/cache/files/'));
  if(!source||u.username||u.password||u.hash||/%2e|%25|%2f|%5c|\.\./i.test(u.pathname))fail(400,'OFFICE_SAVE_URL');
  const relative=u.pathname.slice(source.pathname.replace(/\/$/,'').length);
  const target=new URL(base.pathname.replace(/\/$/,'')+relative+u.search,base);
  const r=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)fail(502,'OFFICE_SAVE_FETCH');
  let size=0;const parts=[];for await(const part of r.body){size+=part.length;if(size>20*1024*1024){await r.body.cancel().catch(()=>{});fail(413,'OFFICE_SIZE')}parts.push(part)}return validate(Buffer.concat(parts),ext);
 }
 async callback(token,raw,body){
  const claim=this.claim(token,'callback'),signed=verify(raw||body.token,this.setting('OFFICE_JWT_SECRET')),p=signed.payload||signed;
  for(const key of ['key','status','url','users','userdata'])if(JSON.stringify(p[key])!==JSON.stringify(body[key]))fail(401,'OFFICE_CALLBACK_SIGNATURE');
  const ctx={org:claim.org,user:'office-engine'},id=claim.id;
  const receipt=p.status===6?'checkpoint:'+claim.generation+':'+String(p.userdata):p.status===2?'final:'+claim.generation+':'+claim.session:hash(JSON.stringify({key:p.key,status:p.status,users:p.users,actions:p.actions}));
  let ext,captured,prior;await this.tx(ctx,async c=>{const h=await this.head(c,ctx,id);ext=h.extension;captured={revision:h.revision,epoch:h.activity_epoch};if(p.key!==this.key(ctx,id,{generation:claim.generation}))fail(401,'OFFICE_SESSION_KEY');const l=(await c.query('SELECT id FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND id=$3 AND user_id=$4 AND generation=$5',[ctx.org,id,claim.session,claim.user,claim.generation])).rows[0];if(!l)fail(401,'OFFICE_CALLBACK_SESSION');prior=(await c.query('SELECT revision FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND receipt=$3',[ctx.org,id,receipt])).rows[0]});
  if(prior)return {error:prior.revision?0:1};
  const data=[2,6].includes(p.status)?await this.candidate(p.url,ext):null;
  return this.tx(ctx,async c=>{
   await c.query('SELECT id FROM collab_document WHERE organization_id=$1 AND id=$2 FOR UPDATE',[ctx.org,id]);const h=await this.head(c,ctx,id);
   const old=(await c.query('SELECT revision FROM collab_office_version WHERE organization_id=$1 AND document_id=$2 AND receipt=$3',[ctx.org,id,receipt])).rows[0];if(old)return {error:old.revision?0:1};
   const origin=(await c.query('SELECT * FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND id=$3',[ctx.org,id,claim.session])).rows[0];
   const allowed=h.generation===claim.generation&&['OPEN','CLOSING'].includes(h.phase)&&await this.leaseCheck(c,ctx,id,h);
   const currentCycle=origin&&origin.active_epoch===h.activity_epoch;
   if(p.status===1){
    if(!allowed){this.pendingDrops.add(p.key);return {error:1}}const users=Array.isArray(p.users)?p.users:[],known=(await c.query('SELECT id FROM collab_office_lease WHERE organization_id=$1 AND document_id=$2 AND generation=$3',[ctx.org,id,h.generation])).rows.map(x=>x.id);if(users.some(u=>!known.includes(u)))fail(400,'OFFICE_UNKNOWN_USER');
    if(origin.active_epoch>0&&(!currentCycle||h.phase==='CLOSING'))return {error:0};
    if(h.users.length&&users.length&&!h.users.some(u=>users.includes(u))){await c.query("UPDATE collab_office SET phase='FROZEN',error='PRESENCE_ORDER_AMBIGUOUS' WHERE organization_id=$1 AND document_id=$2",[ctx.org,id]);return {error:1}}
    const epoch=h.activity_epoch+(!h.users.length&&users.length?1:0);
    if(users.length)await c.query('UPDATE collab_office_lease SET active_epoch=$3 WHERE organization_id=$1 AND document_id=$2 AND id=ANY($4::uuid[])',[ctx.org,id,epoch,users]);
    await c.query("UPDATE collab_office SET users=$3::jsonb,activity_epoch=$4,phase=$5,updated_at=CASE WHEN $5='CLOSING' THEN now() ELSE updated_at END WHERE organization_id=$1 AND document_id=$2",[ctx.org,id,JSON.stringify(users),epoch,users.length?'OPEN':'CLOSING']);return {error:0};
   }
   if(p.status===4){if(allowed&&currentCycle)await c.query("UPDATE collab_office SET phase='CLOSED',users='[]' WHERE organization_id=$1 AND document_id=$2",[ctx.org,id]);return {error:allowed&&currentCycle?0:1}}
   if(!data){await c.query("UPDATE collab_office SET error='ENGINE_SAVE_FAILED' WHERE organization_id=$1 AND document_id=$2 AND generation=$3",[ctx.org,id,claim.generation]);return {error:1}}
   const [generation,sequence]=String(p.userdata||'').split(':'),seq=Number(sequence);
   const fresh=allowed&&currentCycle&&captured.epoch===h.activity_epoch&&captured.revision===h.revision&&(p.status===2||(p.status===6&&generation===h.generation&&Number.isInteger(seq)&&seq>h.saved&&seq<=h.issued));
   const usage=(await c.query('SELECT count(*)::int AS n,coalesce(sum(octet_length(bytes)),0)::bigint AS bytes FROM collab_office_version WHERE organization_id=$1 AND document_id=$2',[ctx.org,id])).rows[0];if(usage.n>=100||Number(usage.bytes)+data.length>200*1024*1024)fail(413,'OFFICE_HISTORY_QUOTA');
   await c.query('INSERT INTO collab_office_version VALUES($1,$2,$3,$4,$5,$6,$7,now())',[ctx.org,id,randomUUID(),fresh?h.revision+1:null,claim.generation,receipt,data]);
   if(!fresh){await c.query("UPDATE collab_office SET phase=CASE WHEN generation=$3 THEN 'FROZEN' ELSE phase END,error='SAVE_QUARANTINED' WHERE organization_id=$1 AND document_id=$2",[ctx.org,id,claim.generation]);return {error:1}}
   await c.query("UPDATE collab_office SET revision=revision+1,saved=$3,phase=$4,users=CASE WHEN $4='CLOSED' THEN '[]'::jsonb ELSE users END,error=NULL,updated_at=now() WHERE organization_id=$1 AND document_id=$2",[ctx.org,id,p.status===6?seq:h.saved,p.status===2?'CLOSED':h.phase]);
   const lastEditor=Array.isArray(p.users)&&p.users.length===1?(await c.query("SELECT u.id,u.name FROM collab_office_lease l JOIN sys_user u ON u.id=l.user_id WHERE l.organization_id=$1 AND l.document_id=$2 AND l.generation=$3 AND l.id::text=$4 AND l.role IN ('OWNER','EDITOR')",[ctx.org,id,claim.generation,p.users[0]])).rows[0]||null:null;
   await this.audit(c,{org:ctx.org,user:null},id,'office:save',{revision:h.revision},{revision:h.revision+1,checksum:hash(data),actor:'office-engine',users:h.users,lastEditor});return {error:0};
  });
 }
 async restart(ctx,id,generation){return this.tx(ctx,async c=>{await this.access(c,ctx,id,'owner');const h=await this.head(c,ctx,id);if(h.phase!=='FROZEN'||h.generation!==generation)fail(409,'OFFICE_SESSION_CHANGED');await c.query("UPDATE collab_office SET generation=$3,phase='CLOSED',users='[]',error=NULL WHERE organization_id=$1 AND document_id=$2",[ctx.org,id,randomUUID()]);await this.audit(c,ctx,id,'office:restart',null,{revision:h.revision});return {revision:h.revision}})}
}
module.exports={OfficeStore,sign,verify,validate};
