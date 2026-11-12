// r20261112-01 后端发布打包：与 deploy/collabspace/prepare-review-backend.cjs 同构，
// 差异：FROM 换成当前生产运行镜像（r20261030-01 构建产物）；tar 在 Windows 下由人工执行（git-bash tar 不认 D: 路径）。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const name='review-r20261112-01';
const root=path.resolve(__dirname,'../..'),stage=path.join(root,'.test-runs/deploy/backend-'+name);
if(fs.existsSync(stage))throw Error('Preserve existing stage');fs.mkdirSync(stage,{recursive:true});
for(const dir of ['apps/api/dist','apps/api/tests','apps/collab/src','packages/collab-store','packages/collab-protocol'])fs.cpSync(path.join(root,dir),path.join(stage,dir),{recursive:true,filter:p=>!path.relative(path.join(root,dir),p).split(path.sep).some(x=>['node_modules','tests'].includes(x)&&dir!=='apps/api/tests')});
for(const file of ['apps/api/package.json','deploy/collabspace/review-migrate.py','deploy/collabspace/review-native-ws.py']){const dest=path.join(stage,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.copyFileSync(path.join(root,'.test-runs/deploy',name,'SOURCE_MANIFEST.json'),path.join(stage,'SOURCE_MANIFEST.json'));
fs.writeFileSync(path.join(stage,'Dockerfile.api'),`FROM sha256:c47eb2f45feefcee24fedcd13fadf1a3a19f5740a39031cf00d0e7d22522a74d
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
fs.writeFileSync(path.join(stage,'Dockerfile.ws'),`FROM sha256:4b52be9ced045d05bc1746f782308a0af2c049ef1f86431c1a02ed442355445b
COPY packages /app/packages
COPY apps/collab/src /app/apps/collab/src
LABEL org.opencontainers.image.version="${name}"
`);
const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(stage,dir),{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())walk(p);else files.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,p))).digest('hex')});}}walk('');fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({name,files},null,2));
console.log(JSON.stringify({stage,files:files.length,note:'tar manually: tar -czf backend-'+name+'.tgz -C backend-'+name+' .'}));
