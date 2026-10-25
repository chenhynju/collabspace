// Build locally; server only adds small, verified application/dependency layers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=process.env.VOICE_BASE_IMAGE;
if(!/^sha256:[a-f0-9]{64}$/.test(base||''))throw Error('Verified running Linux API image digest required');
const target=path.join(root,'.test-runs/deploy/voice-r20261025-04');
if(fs.existsSync(target))throw Error('Preserve existing release directory');
fs.mkdirSync(target,{recursive:true});
const req=createRequire(path.join(root,'apps/api/package.json')),seen=new Map();
function pkg(name,from){
 let f;try{f=from.resolve(name+'/package.json');}catch{let p=path.dirname(from.resolve(name));while(!fs.existsSync(path.join(p,'package.json')))p=path.dirname(p);f=path.join(p,'package.json');}
 const json=JSON.parse(fs.readFileSync(f,'utf8'));
 if(seen.has(name)){if(seen.get(name)!==json.version)throw Error('Flat dependency conflict: '+name);return;}
 seen.set(name,json.version);const source=path.dirname(f),dest=path.join(target,'vendor/node_modules',name);
 fs.cpSync(source,dest,{recursive:true,dereference:true,filter:p=>!path.relative(source,p).split(path.sep).some(x=>['node_modules','.git'].includes(x))});
 const local=createRequire(f);for(const dependency of Object.keys(json.dependencies||{}))pkg(dependency,local);
}
pkg('bullmq',req);
const files=['apps/api/dist/app.module.js','apps/api/dist/modules/im/im.controller.js','apps/api/dist/modules/im/dto/im.dto.js'];
for(const f of fs.readdirSync(path.join(root,'apps/api/dist/modules/voice')))if(f.endsWith('.js'))files.push('apps/api/dist/modules/voice/'+f);
for(const f of files){const dest=path.join(target,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest);}
for(const [from,to] of [['deploy/collabspace/compose.yml','compose.yml'],['packages/collab-store/voice.sql','voice.sql']])fs.copyFileSync(path.join(root,from),path.join(target,to));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(target,'RELEASE_SOURCE'),commit+' + voice worktree; see manifest.json\n');
fs.writeFileSync(path.join(target,'Dockerfile'),`FROM ${base}\nCOPY vendor/node_modules /app/voice-deps/node_modules\nENV NODE_PATH=/app/voice-deps/node_modules:/app/assistant-deps/node_modules\n`+files.map(f=>`COPY ${f} /app/${f}\n`).join(''));
const manifest=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const file=path.join(p,e.name);if(e.isDirectory())walk(file);else{if(/\.(node|dll|exe)$/i.test(file)||e.name.startsWith('.env'))throw Error('Native/secret file rejected: '+file);manifest.push({path:path.relative(target,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}}}walk(target);
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({base,baseCommit:commit,dirtyWorktree:true,dependencies:[...seen].map(([name,version])=>({name,version})),files:manifest},null,2));
console.log(JSON.stringify({target,base,baseCommit:commit,packages:seen.size,files:manifest.length,bytes:manifest.reduce((sum,f)=>sum+f.bytes,0)}));
