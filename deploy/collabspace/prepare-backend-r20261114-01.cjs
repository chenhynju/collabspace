// r20261114-01 后端发布打包：仅邮件测试汇（BUG-001）一个文件变更，api-only。
// 与 prepare-backend-r20261112-01.cjs 同构；tar 在 Windows 下由人工以 POSIX 路径执行。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const name='review-r20261114-01';
const root=path.resolve(__dirname,'../..'),stage=path.join(root,'.test-runs/deploy/backend-'+name);
if(fs.existsSync(stage))throw Error('Preserve existing stage');fs.mkdirSync(stage,{recursive:true});
// 只带变更文件与其 sourcemap/声明；其余运行时完全继承当前生产镜像
const rel='apps/api/dist/modules/mail/mail.service';
for(const ext of ['.js','.js.map','.d.ts']){const src=path.join(root,rel+ext);const dest=path.join(stage,rel+ext);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);}
fs.writeFileSync(path.join(stage,'Dockerfile.api'),`FROM sha256:e686fd9505c8a90a167cea07d2f9cc3e80dd3627b46c33ca1075609abd8c66a6
USER root
COPY apps/api/dist/modules/mail/mail.service.js /app/apps/api/dist/modules/mail/mail.service.js
COPY apps/api/dist/modules/mail/mail.service.js.map /app/apps/api/dist/modules/mail/mail.service.js.map
COPY apps/api/dist/modules/mail/mail.service.d.ts /app/apps/api/dist/modules/mail/mail.service.d.ts
LABEL org.opencontainers.image.version="${name}"
USER app
`);
const files=[];function walk(dir){for(const e of fs.readdirSync(path.join(stage,dir),{withFileTypes:true})){const p=path.posix.join(dir,e.name);if(e.isDirectory())walk(p);else files.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,p))).digest('hex')});}}walk('');fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({name,files},null,2));
console.log(JSON.stringify({stage,files:files.length,note:'tar manually: tar -czf backend-'+name+'.tgz -C backend-'+name+' .'}));
