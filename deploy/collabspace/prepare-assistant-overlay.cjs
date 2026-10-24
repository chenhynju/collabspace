// Offline overlay from the tested build and the frozen pnpm dependency closure.
// Never copies .env, local test data, or native binaries from Windows.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),target=path.resolve(root,'.test-runs/deploy/assistant-api-r20261025-01');
const base=process.env.ASSISTANT_BASE_IMAGE;
if(!/^sha256:[a-f0-9]{64}$/.test(base||''))throw Error('Verified running API image digest required');
if(fs.existsSync(target))throw Error('Overlay already exists; preserve it and use a fresh release');
fs.mkdirSync(target,{recursive:true});
const apiRequire=createRequire(path.join(root,'apps/api/package.json')),seen=new Map(),manifest=[];
function copyPackage(name,from){
 let file;try{file=from.resolve(name+'/package.json');}catch{let p=path.dirname(from.resolve(name));while(!fs.existsSync(path.join(p,'package.json')))p=path.dirname(p);file=path.join(p,'package.json');}
 const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
 if(seen.has(name)){if(seen.get(name)!==pkg.version)throw Error('Flat dependency conflict: '+name);return;}
 seen.set(name,pkg.version);manifest.push({name,version:pkg.version});
 const dest=path.join(target,'vendor/node_modules',name),source=path.dirname(file);
 fs.cpSync(source,dest,{recursive:true,dereference:true,filter:p=>!path.relative(source,p).split(path.sep).includes('node_modules')});
 const local=createRequire(file);
 for(const dep of Object.keys(pkg.dependencies||{}))copyPackage(dep,local);
 for(const dep of Object.keys(pkg.peerDependencies||{})){try{local.resolve(dep);}catch{continue;}copyPackage(dep,local);}
}
copyPackage('mammoth',apiRequire);copyPackage('pdf-parse',apiRequire);
const files=['apps/api/dist/app.module.js','apps/api/dist/modules/mail/mail.service.js','apps/api/dist/modules/mail/mail-webhook.service.js'];
for(const f of fs.readdirSync(path.join(root,'apps/api/dist/modules/assistant')))if(f.endsWith('.js'))files.push('apps/api/dist/modules/assistant/'+f);
for(const f of files){const dest=path.join(target,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest);}
for(const f of ['deploy/collabspace/compose.yml','packages/collab-store/assistant.sql']){const dest=path.join(target,path.basename(f));fs.copyFileSync(path.join(root,f),dest);}
const hashes=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else{if(/\.(node|dll|exe)$/i.test(e.name))throw Error('Unexpected platform binary: '+e.name);hashes.push({path:path.relative(target,p).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}}}
walk(target);
fs.writeFileSync(path.join(target,'dependency-manifest.json'),JSON.stringify({base,packages:manifest.sort((a,b)=>a.name.localeCompare(b.name)),files:hashes},null,2));
fs.writeFileSync(path.join(target,'Dockerfile'),`FROM ${base}\nCOPY vendor/node_modules /app/assistant-deps/node_modules\nENV NODE_PATH=/app/assistant-deps/node_modules\n`+files.map(f=>`COPY ${f} /app/${f}\n`).join(''));
console.log(JSON.stringify({target,packages:seen.size,files:hashes.length,base}));
