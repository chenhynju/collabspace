const {test}=require('node:test'),assert=require('node:assert/strict');
const {wavInfo,digest,personaEvent}=require('../dist/modules/voice/voice-domain');
const {SpeechProvider}=require('../dist/modules/voice/speech-provider');
function wav(seconds=1){const b=Buffer.alloc(44+Math.round(seconds*32000));b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
test('actual WAV duration and PCM validation rejects MIME spoof, overlong, stereo and truncation',()=>{
 assert.equal(wavInfo(wav()).seconds,1);assert.equal(wavInfo(wav(60)).seconds,60);
 for(const b of [Buffer.from('fake'),wav(61),wav().subarray(0,100)])assert.throws(()=>wavInfo(b));
 const stereo=wav();stereo.writeUInt16LE(2,22);assert.throws(()=>wavInfo(stereo));
 const forged=wav();forged.writeUInt32LE(0xffffffff,40);assert.throws(()=>wavInfo(forged));
 assert.notEqual(digest('ab','c'),digest('a','bc'));
});
test('Agent completion requires runtime result; event does not execute skills',()=>{
 assert.throws(()=>personaEvent({version:1,runId:'r',source:'skill',state:'completed',authority:'ui'}));
 assert.throws(()=>personaEvent({version:1,runId:'r',source:'skill',state:'completed',authority:'runtime'}));
 assert.equal(personaEvent({version:1,runId:'r',source:'agent',state:'completed',authority:'runtime',resultRef:'job:1'}).state,'completed');
});
test('Azure adapter is fail-closed; escaped SSML, final transcript, failed response and abort propagate without retries',async()=>{
 const old={key:process.env.AZURE_SPEECH_KEY,region:process.env.AZURE_SPEECH_REGION,fetch:global.fetch};
 try{
  delete process.env.AZURE_SPEECH_KEY;const p=new SpeechProvider();await assert.rejects(p.run('STT',wav(),'zh-CN',new AbortController().signal),e=>e.getStatus()===503);
  process.env.AZURE_SPEECH_KEY='synthetic';process.env.AZURE_SPEECH_REGION='eastus';let calls=0,ssml;
  global.fetch=async(url,opts)=>{calls++;ssml=opts.body;return new Response(wav());};
  assert.ok((await p.run('TTS','<script>&你好','zh-CN',new AbortController().signal)).audio);assert.match(ssml,/&lt;script&gt;&amp;你好/);assert.equal(calls,1);
  global.fetch=async()=>new Response(JSON.stringify({RecognitionStatus:'Success',DisplayText:'Synthetic hello 你好'}));
  assert.equal((await p.run('STT',wav(),'en-US',new AbortController().signal)).text,'Synthetic hello 你好');
  global.fetch=async()=>{calls++;return new Response('',{status:503});};const n=calls;await assert.rejects(p.run('TTS','x','en-US',new AbortController().signal));assert.equal(calls,n+1);
 }finally{global.fetch=old.fetch;for(const [k,v] of [['AZURE_SPEECH_KEY',old.key],['AZURE_SPEECH_REGION',old.region]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
module.exports={wav};
