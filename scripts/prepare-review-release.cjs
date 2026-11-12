// Archive the actual working tree, including reviewed uncommitted feature work.
// Credentials, ignored files, databases and existing release assets stay outside it.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),name=process.argv[2];
if(!/^review-r\d{8}-\d{2}$/.test(name||''))throw Error('Expected unique review-rYYYYMMDD-NN release name');
const stage=path.join(root,'.test-runs/deploy',name);
if(fs.existsSync(stage))throw Error('Release already exists; preserve its evidence');
const files=cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
fs.mkdirSync(stage,{recursive:true});const manifest=[];
for(const relative of files){
 const file=path.join(root,relative);
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
 if(/(^|\/)\.env($|\.)/.test(relative)&&!relative.endsWith('.example'))throw Error('Unexpected environment file: '+relative);
 if(/\.(pem|key|dump|sql\.gz)$/i.test(relative))throw Error('Unexpected private asset: '+relative);
 const bytes=fs.readFileSync(file),target=path.join(stage,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
 manifest.push({path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const identity={name,baseCommit:commit,workingTree:true,files:manifest};
fs.writeFileSync(path.join(stage,'SOURCE_MANIFEST.json'),JSON.stringify(identity,null,2));
cp.execFileSync('tar',['-czf',stage+'.tgz','-C',stage,'.']);
const archive=fs.readFileSync(stage+'.tgz');
console.log(JSON.stringify({stage,baseCommit:commit,files:manifest.length,bytes:archive.length,sha256:crypto.createHash('sha256').update(archive).digest('hex')}));
