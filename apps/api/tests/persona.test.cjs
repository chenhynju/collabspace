const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const {sourceDraft,CONSENT_VERSION}=require('../dist/modules/voice/persona-domain');
const png=fs.readFileSync(require('node:path').join(__dirname,'../../web/public/personas/agent-lan-v1.png'));
const input=()=>({requestId:randomUUID(),kind:'PHOTO',locale:'zh-CN',consent:'true',consentVersion:CONSENT_VERSION});
test('persona private drafts: explicit consent, actual container, dimensions, kind and limits',()=>{
 const b=input(),r=sourceDraft(b,png);assert.equal(r.mime,'image/png');assert.equal(r.hash,sourceDraft(b,png).hash);
 for(const body of [{...b,consent:'false'},{...b,consentVersion:'old'},{...b,kind:'VIDEO'},{...b,locale:'unknown'},{...b,requestId:'bad'}])assert.throws(()=>sourceDraft(body,png));
 for(const bytes of [Buffer.from('<html>fake image</html>'),Buffer.alloc(20*1024*1024+1),Buffer.alloc(0)])assert.throws(()=>sourceDraft(b,bytes));
 const huge=Buffer.from(png);huge.writeUInt32BE(100000,16);assert.throws(()=>sourceDraft(b,huge));
});
function loadSynth(stub){const out={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/modules/voice/azure-viseme.js'),'utf8'),{exports:out,Buffer,URL,require:id=>id==='microsoft-cognitiveservices-speech-sdk'?stub:require('../dist/modules/voice/voice-domain')});return out.synthesizeWithVisemes;}
test('SDK contract fixture: one synthesis binds offsets to its own audio and closes on success/abort',async()=>{
 const audio=Buffer.alloc(64);audio.write('RIFF');let instance,calls=0,closed=0,ssml;
 const sdk={SpeechConfig:{fromEndpoint:(url,key)=>{assert.match(url.hostname,/eastus\.tts\.speech\.microsoft\.com/);assert.equal(key,'synthetic');return {}; }},SpeechSynthesisOutputFormat:{Riff16Khz16BitMonoPcm:1},ResultReason:{SynthesizingAudioCompleted:1},SpeechSynthesizer:class{constructor(){instance=this;}close(){closed++;}speakSsmlAsync(s,ok){calls++;ssml=s;this.visemeReceived(null,{audioOffset:2000000,visemeId:3});this.visemeReceived(null,{audioOffset:1000000,visemeId:5});this.visemeReceived(null,{audioOffset:3000000,visemeId:0});ok({reason:1,audioData:audio});}}};
 const synth=loadSynth(sdk),r=await synth('<hello>','en-US','eastus','global','synthetic',new AbortController().signal);
 assert.equal(calls,1);assert.equal(closed,1);assert.match(ssml,/&lt;hello&gt;/);assert.equal(r.audio.toString('ascii',0,4),'RIFF');assert.deepEqual(JSON.parse(JSON.stringify(r.visemes)),[{offsetMs:200,id:3},{offsetMs:300,id:0}]);
 sdk.SpeechSynthesizer=class{constructor(){instance=this;}close(){closed++;}speakSsmlAsync(){calls++;}};const c=new AbortController(),waiting=loadSynth(sdk)('x','en-US','eastus','global','synthetic',c.signal);await new Promise(resolve=>setImmediate(resolve));c.abort();await assert.rejects(waiting);assert.equal(closed,2);sdk.SpeechSynthesizer=class{close(){closed++;}speakSsmlAsync(){throw Error('synthetic synchronous failure');}};await assert.rejects(loadSynth(sdk)('x','en-US','eastus','global','synthetic',new AbortController().signal));assert.equal(closed,3);
});
