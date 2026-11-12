// Bounded real-vendor integration: two short synthetic phrases, no retries or personal audio.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');require('../apps/api/node_modules/ts-node').register({project:path.join(root,'apps/api/tsconfig.json'),transpileOnly:true});
const env=require('../apps/api/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'.test-runs/private/third-party.env')));
for(const k of ['SPEECH_PROVIDER','ELEVENLABS_API_KEY','ELEVENLABS_STT_MODEL','ELEVENLABS_TTS_MODEL','ELEVENLABS_VOICE_ID_ZH','ELEVENLABS_VOICE_ID_EN'])if(env[k])process.env[k]=env[k];
const {SpeechProvider}=require('../apps/api/src/modules/voice/speech-provider'),{wavInfo}=require('../apps/api/src/modules/voice/voice-domain');
const provider=new SpeechProvider(),result={kind:'REAL_VENDOR_SYNTHETIC_SPEECH',date:new Date().toISOString(),provider:'elevenlabs',requests:0,checks:[],scope:'Real overseas TTS then ASR of generated synthetic speech; not microphone recognition, browser playback or full application acceptance'};
const dir=path.join(root,'.test-runs/speech-live');fs.mkdirSync(dir,{recursive:true});
async function run(){assert.equal(provider.selected,'elevenlabs','Overseas provider must be explicitly selected');assert.equal(provider.ready,true,'Required provider fields are incomplete');
 for(const [language,text,expected] of [['zh-CN','你好，今天我们一起完成项目。','项目'],['en-US','Hello. We can work together today.','work together']]){
  result.stage=language+':TTS';result.requests++;const t=await provider.run('TTS',text,language,AbortSignal.timeout(45000));const info=wavInfo(t.audio);fs.writeFileSync(path.join(dir,language+'.wav'),t.audio);result.checks.push({language,operation:'TTS',seconds:info.seconds,bytes:t.audio.length,pass:true});
  result.stage=language+':STT';result.requests++;const r=await provider.run('STT',t.audio,language,AbortSignal.timeout(45000));const pass=r.text.toLowerCase().includes(expected);result.checks.push({language,operation:'STT',expectedPhrase:expected,transcript:r.text,pass});assert.ok(pass,'Synthetic phrase was not recognized as expected');
 }
 console.log(JSON.stringify(result));
}
run().catch(e=>{result.failure={name:e.name,message:e.message};process.exitCode=1;console.error('Speech test failed (no retry): '+JSON.stringify(result.failure));}).finally(()=>{fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(dir,'result-'+Date.now()+'.json'),JSON.stringify(result,null,2));});
