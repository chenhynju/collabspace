'use client';
import {useEffect,useRef,useState} from 'react';
import RiggedAvatarStudio from './RiggedAvatarStudio';
import AvatarSpeechPreview from './AvatarSpeechPreview';
import {useAuthStore} from '@/store/auth';
import {observeCharacter} from './character-playback';
import type {CharacterPlayback} from './AvatarPreview';
import * as THREE from 'three';
import {createPortraitRig,motionLooks,type MotionLook} from './portrait-rig';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
type Action='idle'|'walk'|'wave'|'nod';
const names:Record<Action,string>={idle:'待机',walk:'走路',wave:'挥手',nod:'点头'};
export default function MotionStudio(){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);return <MotionSession key={org+':'+user} org={org} user={user}/>;
}
function MotionSession({org,user}:{org:string|null;user:string|undefined}){
 const [prototype,setPrototype]=useState(false),[playback,setPlayback]=useState<CharacterPlayback|null>(null),[speechProject,setSpeechProject]=useState('');
 useEffect(()=>observeCharacter(JSON.stringify([org,user,speechProject,'assistant']),setPlayback),[org,user,speechProject]);
 const [selected,setSelected]=useState<string>(motionLooks[0].id);const look=motionLooks.find(p=>p.id===selected)||motionLooks[0];
 return <div><div className="mx-auto max-w-6xl px-6 pt-4"><button onClick={()=>setPrototype(v=>!v)} className="text-sm text-indigo-700 underline">{prototype?'查看完整骨骼人物':'对比旧版动作原型'}</button></div>{!prototype?<><AvatarSpeechPreview projectId={speechProject} onProjectChange={setSpeechProject}/><RiggedAvatarStudio playback={playback}/></>:<><section aria-label="选择三维形象" className="mx-auto max-w-6xl px-6 pt-6"><h2 className="mb-3 font-semibold">从现有形象试做的三维角色</h2><div className="flex flex-wrap gap-3">{motionLooks.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)} className={'flex items-center gap-3 rounded-xl border p-3 text-left '+(selected===p.id?'border-indigo-500 bg-indigo-50':'bg-white')}><img src={p.poster} alt={p.name+'原始静态形象'} className="h-20 w-16 rounded-lg object-cover object-top"/><span>{p.name}<small className="block text-slate-500">原图参考 · 三维试版</small></span></button>)}</div></section><MotionScene key={look.id} look={look}/></>}</div>;
}
function MotionScene({look}:{look:MotionLook}){
 const position=useRef<HTMLOutputElement>(null),host=useRef<HTMLDivElement>(null),input=useRef({action:'idle' as Action,keys:new Set<string>(),reset:0,color:look.coat as string}),[action,setAction]=useState<Action>('idle'),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const choose=(v:Action)=>{input.current.action=v;setAction(v);};
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('无法启动3D，请启用浏览器硬件加速后重试。');return;}
  let disposed=false,frame=0,seenReset=0;const scene=new THREE.Scene();scene.background=new THREE.Color('#edf1fa');scene.fog=new THREE.Fog('#edf1fa',12,28);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','三维角色场景，方向键或WASD移动');el.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(42,1,.1,50);camera.position.set(3,2.5,4);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.2,0);controls.enableDamping=true;controls.minDistance=2.8;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.48;
  scene.add(new THREE.HemisphereLight('#ffffff','#7c87ab',2.3));const sun=new THREE.DirectionalLight('#fff5e4',3);sun.position.set(4,8,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#e3e9f4',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(16,16,'#b4bed6','#d0d9e9');grid.position.y=.005;scene.add(grid);
  const {bot,body,head,leftArm,rightArm,leftLeg,rightLeg,suit}=createPortraitRig(look);scene.add(bot);
  const held=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(held.has(k)){e.preventDefault();input.current.keys.add(k);}},up=(e:KeyboardEvent)=>{input.current.keys.delete(e.key.toLowerCase());},clear=()=>input.current.keys.clear();
  renderer.domElement.addEventListener('keydown',down);renderer.domElement.addEventListener('keyup',up);renderer.domElement.addEventListener('blur',clear);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  const lost=(e:Event)=>{e.preventDefault();setError('3D渲染中断，请刷新页面恢复。');cancelAnimationFrame(frame);};renderer.domElement.addEventListener('webglcontextlost',lost);
  const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(el);
  const clock=new THREE.Clock();let t=0;const animate=()=>{if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;t+=dt;const v=input.current,k=v.keys;
   if(seenReset!==v.reset){seenReset=v.reset;bot.position.set(0,0,0);bot.rotation.y=0;camera.position.set(3,2.5,4);controls.target.set(0,1.2,0);}
   if(position.current)position.current.textContent=`X ${bot.position.x.toFixed(2)} · Z ${bot.position.z.toFixed(2)}`;
   suit.color.set(v.color);let x=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),z=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));const moving=!!(x||z)||v.action==='walk';if(!x&&!z&&v.action==='walk')z=1;
   if(moving){const n=Math.hypot(x,z);bot.position.x=THREE.MathUtils.clamp(bot.position.x+x/n*dt*1.3,-5,5);bot.position.z=THREE.MathUtils.clamp(bot.position.z+z/n*dt*1.3,-5,5);bot.rotation.y=Math.atan2(x,z);}
   body.position.y=moving?Math.abs(Math.sin(t*8))*.035:Math.sin(t*2)*.012;leftLeg.rotation.x=moving?Math.sin(t*8)*.55:0;rightLeg.rotation.x=-leftLeg.rotation.x;leftArm.rotation.set(moving?-Math.sin(t*8)*.4:0,0,-.13);rightArm.rotation.set(moving?Math.sin(t*8)*.4:0,0,.13);head.rotation.x=v.action==='nod'?Math.sin(t*5)*.23:0;
   if(v.action==='wave'){rightArm.rotation.z=2.45+Math.sin(t*7)*.25;rightArm.rotation.x=-.2;}controls.update();renderer.render(scene,camera);
  };setReady(true);animate();
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();clear();renderer.domElement.removeEventListener('keydown',down);renderer.domElement.removeEventListener('keyup',up);renderer.domElement.removeEventListener('blur',clear);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}if(o instanceof THREE.GridHelper){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});const materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <main aria-label="3D Agent实验室" className="mx-auto max-w-6xl space-y-5 p-6"><div><p className="text-sm text-indigo-600">CollabSpace · Agent实验室</p><h1 className="text-3xl font-semibold">{look.name} · 可动3D Agent</h1><p className="mt-2 text-slate-600">按原图特征制作的关节式卡通人物。拖动旋转视角，滚轮缩放；点击场景后用 WASD 或方向键移动。</p></div>
 <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div ref={host} className="h-[480px] w-full"/><div className="flex flex-wrap items-center gap-3 border-t p-4">{(Object.keys(names) as Action[]).map(a=><button key={a} aria-pressed={action===a} onClick={()=>choose(a)} className={'rounded-lg border px-4 py-2 '+(action===a?'bg-indigo-600 text-white':'bg-white')}>{names[a]}</button>)}<button onClick={()=>{choose('idle');input.current.keys.clear();input.current.reset++;}} className="rounded-lg border px-4 py-2">回到原点</button><label className="ml-auto flex items-center gap-2">服装颜色<input aria-label="服装颜色" type="color" defaultValue={look.coat} onChange={e=>{input.current.color=e.target.value;}}/></label></div></div>
 <p>角色位置：<output ref={position} aria-label="角色位置">X 0.00 · Z 0.00</output></p><p role="status">{ready?'3D场景已就绪':'正在准备3D场景…'}</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<p className="text-sm text-slate-500">三维卡通试版：保留原图发型、配色和服装特征，背面及下半身为补充设计。语音口型尚未接入。</p></main>;
}
