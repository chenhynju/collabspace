const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const name=process.argv[2];if(!/^review-r\d{8}-\d{2}$/.test(name||''))throw Error('Unique release name required');
const root=path.resolve(__dirname,'../..'),stage=path.join(root,'.test-runs/deploy/backend-'+name);
if(fs.existsSync(stage))throw Error('Preserve existing stage');fs.mkdirSync(stage,{recursive:true});
for(const dir of ['apps/api/dist','apps/api/tests','apps/collab/src','packages/collab-store','packages/collab-protocol'])fs.cpSync(path.join(root,dir),path.join(stage,dir),{recursive:true,filter:p=>!path.relative(path.join(root,dir),p).split(path.sep).some(x=>['node_modules','tests'].includes(x)&&dir!=='apps/api/tests')});
for(const file of ['apps/api/package.json','deploy/collabspace/review-migrate.py','deploy/collabspace/review-native-ws.py']){const dest=path.join(stage,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.copyFileSync(path.join(root,'.test-runs/deploy',name,'SOURCE_MANIFEST.json'),path.join(stage,'SOURCE_MANIFEST.json'));
fs.writeFileSync(path.join(stage,'Dockerfile.api'),`FROM sha256:e5bbfc70a1c93e8d5053e90e163d2bed375c32ed100826f28af39307f626e9a3
USER root
RUN npm install --prefix /opt/meeting-runtime --omit=dev --ignore-scripts --no-audit --no-fund livekit-server-sdk@2.19.2
COPY apps/api/dist /app/apps/api/dist
COPY apps/api/tests /app/apps/api/tests
COPY apps/api/package.json /app/apps/api/package.json
COPY packages /app/packages
RUN ln -sfn /opt/meeting-runtime/node_modules/livekit-server-sdk /app/apps/api/node_modules/livekit-server-sdk
LABEL org.opencontainers.image.version="${name}"
USER app
`);
fs.writeFileSync(path.join(stage,'Dockerfile.ws'),`FROM sha256:e4862c6eb6ef3e283dee9a85ae287d1c9d6a6dd76221642bc02d0db9a279c307
COPY packages /app/packages
COPY apps/collab/src /app/apps/collab/src
LABEL org.opencontainers.image.version="${name}"
`);
const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(stage,dir),{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())walk(p);else files.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,p))).digest('hex')});}}walk('');fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({name,files},null,2));
cp.execFileSync('tar',['-czf',stage+'.tgz','-C',stage,'.']);const bytes=fs.readFileSync(stage+'.tgz');console.log(JSON.stringify({stage,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
