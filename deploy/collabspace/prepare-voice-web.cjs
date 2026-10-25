const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const release=process.env.VOICE_WEB_RELEASE||'r20261025-04-v2';
if(!/^r[0-9]{8}-[0-9]{2}(?:-v[0-9]+)?$/.test(release))throw Error('Invalid source snapshot release');
const root=path.resolve(__dirname,'../..'),target=path.join(root,'.test-runs/deploy/voice-web-'+release);
if(fs.existsSync(target))throw Error('Preserve existing source snapshot');
fs.mkdirSync(target,{recursive:true});
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const allowed=files.filter(f=>['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.gitignore','.vercelignore'].includes(f)||f.startsWith('apps/web/')||f.startsWith('packages/collab-protocol/')).filter(f=>!f.split('/').some(p=>p.startsWith('.env')||['node_modules','dist','.test-runs'].includes(p)||p.startsWith('.next')));
const manifest=[];
for(const file of allowed){if(file.split('/').some(p=>p.startsWith('.env')||['node_modules','dist','.test-runs'].includes(p)||p.startsWith('.next')))throw Error('Unexpected artifact in snapshot');const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);manifest.push({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')});}
fs.mkdirSync(path.join(target,'.vercel'),{recursive:true});fs.copyFileSync(path.join(root,'.vercel/project.json'),path.join(target,'.vercel/project.json'));
fs.writeFileSync(path.join(root,'.test-runs/deploy/voice-web-'+release+'-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({target,files:manifest.length,sourceHash:crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex')}));
