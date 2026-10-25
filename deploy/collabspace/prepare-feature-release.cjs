// Verified Linux base retains native Prisma and frozen dependencies; overlay only application files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=process.env.FEATURE_BASE_IMAGE;
if(!/^sha256:[a-f0-9]{64}$/.test(base||''))throw Error('Verified assistant Linux image digest required');
const target=path.join(root,'.test-runs/deploy/features-r20261025-02');
if(fs.existsSync(target))throw Error('Preserve previous overlay; choose a new release');
fs.mkdirSync(target,{recursive:true});
for(const dir of ['apps/api/dist','packages/collab-store']){
 fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true,filter:p=>{
  const parts=path.relative(path.join(root,dir),p).split(path.sep);
  return !parts.some(x=>['node_modules','tests','.env','.test-runs'].includes(x))&&!/\.tsbuildinfo$/.test(p);
 }});
}
fs.copyFileSync(path.join(root,'deploy/collabspace/compose.yml'),path.join(target,'compose.yml'));
fs.copyFileSync(path.join(root,'packages/collab-store/assistant.sql'),path.join(target,'assistant.sql'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(target,'RELEASE_SOURCE'),commit+'\n');
fs.writeFileSync(path.join(target,'Dockerfile'),`FROM ${base}\nCOPY apps/api/dist /app/apps/api/dist\nCOPY packages/collab-store /app/packages/collab-store\n`);
const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else{if(/\.(node|dll|exe)$/i.test(p)||entry.name.startsWith('.env'))throw Error('Unexpected credential/native file');files.push({path:path.relative(target,p).split(path.sep).join('/'),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}}}walk(target);
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({commit,base,files},null,2));console.log(JSON.stringify({target,commit,files:files.length}));
