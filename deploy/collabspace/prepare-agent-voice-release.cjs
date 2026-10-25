// No dependency installation or database migration: overlay verified JS on the current Linux image.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),base=process.env.VOICE_BASE_IMAGE,release=process.env.AGENT_VOICE_RELEASE||'r20261025-06';
if(!/^sha256:[a-f0-9]{64}$/.test(base||'')||!/^r[0-9]{8}-[0-9]{2}$/.test(release))throw Error('Pinned base image and release required');
const target=path.join(root,'.test-runs/deploy/agent-voice-'+release);if(fs.existsSync(target))throw Error('Preserve existing release');fs.mkdirSync(target,{recursive:true});
const files=['assistant.controller','assistant.module','assistant.service','assistant-runtime.controller','assistant-runtime.service'].map(n=>'apps/api/dist/modules/assistant/'+n+'.js').concat('apps/api/dist/modules/voice/speech-provider.js');
for(const file of files){const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.copyFileSync(path.join(root,'deploy/collabspace/compose.yml'),path.join(target,'compose.yml'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();fs.writeFileSync(path.join(target,'RELEASE_SOURCE'),commit+'\n');
fs.writeFileSync(path.join(target,'Dockerfile'),`FROM ${base}\nLABEL org.opencontainers.image.revision="${commit}"\n`+files.map(f=>`COPY ${f} /app/${f}\n`).join(''));
const manifest=files.concat('compose.yml','RELEASE_SOURCE','Dockerfile').map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(target,file))).digest('hex')}));
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({base,commit,release,files:manifest},null,2));console.log(JSON.stringify({target,commit,release,files:manifest.length}));
