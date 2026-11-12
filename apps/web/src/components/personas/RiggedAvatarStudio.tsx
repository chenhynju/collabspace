'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils,type VRM} from '@pixiv/three-vrm';
import {mouthAt} from './character-catalog';
import type {CharacterPlayback} from './AvatarPreview';
type Action='idle'|'happy'|'wave'|'nod'|'walk';
const labels:Record<Action,string>={idle:'自然待机',happy:'微笑',wave:'挥手',nod:'点头',walk:'走路'};
export default function RiggedAvatarStudio({playback}:{playback?:CharacterPlayback|null}){
 const host=useRef<HTMLDivElement>(null),mouthState=useRef<HTMLOutputElement>(null),motion=useRef<Action>('idle'),playing=useRef(playback),reset=useRef(0),fullBody=useRef(false),[action,setAction]=useState<Action>('idle'),[ready,setReady]=useState(false),[error,setError]=useState('');playing.current=playback;
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError('无法启动3D，请检查浏览器硬件加速。');return;}
  let disposed=false,frame=0,vrm:VRM|undefined;const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);scene.background=new THREE.Color('#f2f0ec');
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','完整骨骼人物三维场景');el.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(30,1,.1,30);camera.position.set(.05,1.45,1.65);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.4,0);controls.enableDamping=true;controls.minDistance=1.1;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.53;
  scene.add(new THREE.HemisphereLight('#ffffff','#c1b5b2',2));const light=new THREE.DirectionalLight('#fff4e6',2);light.position.set(2,3,4);scene.add(light);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.2,64),new THREE.MeshStandardMaterial({color:'#e1ddd6',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;scene.add(floor);
  const resize=new ResizeObserver(()=>{if(el.clientWidth){renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();}});resize.observe(el);
  const lost=(e:Event)=>{e.preventDefault();setError('渲染中断，请重新打开预览。');cancelAnimationFrame(frame);};renderer.domElement.addEventListener('webglcontextlost',lost);
  const abort=new AbortController();
  void(async()=>{
   const response=await fetch('/personas/models/pixiv-vrm1-sample.vrm',{signal:abort.signal});if(!response.ok)throw Error('model');const bytes=await response.arrayBuffer();if(disposed)return;
   const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));const gltf=await loader.parseAsync(bytes,'');const loaded=gltf.userData.vrm as VRM;if(!loaded)throw Error('VRM missing');if(disposed){VRMUtils.deepDispose(loaded.scene);return;}vrm=loaded;root.add(vrm.scene);VRMUtils.rotateVRM0(vrm);vrm.scene.traverse(o=>{o.frustumCulled=false;});
   const clock=new THREE.Clock();let t=0,lastReset=0;const bone=(name:any)=>vrm?.humanoid.getNormalizedBoneNode(name);const pose=(name:any,x=0,y=0,z=0)=>bone(name)?.rotation.set(x,y,z);
   const draw=()=>{if(disposed)return;frame=requestAnimationFrame(draw);const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;t+=dt;const a=motion.current;
    if(lastReset!==reset.current){lastReset=reset.current;root.position.set(0,0,0);root.rotation.set(0,0,0);if(fullBody.current){camera.position.set(.1,1.1,3.9);controls.target.set(0,.85,0);}else{camera.position.set(.05,1.45,1.65);controls.target.set(0,1.4,0);}}
    pose('leftUpperArm',0,0,-1.2);pose('rightUpperArm',0,0,1.2);pose('leftLowerArm',0,0,-.08);pose('rightLowerArm',0,0,.08);pose('head',a==='nod'?Math.sin(t*4)*.15:Math.sin(t*.7)*.015);pose('spine',Math.sin(t*1.4)*.012);pose('leftUpperLeg');pose('rightUpperLeg');pose('leftLowerLeg');pose('rightLowerLeg');
    if(a==='wave'){pose('rightUpperArm',-.18,0,-.6);pose('rightLowerArm',0,0,-1-Math.sin(t*5)*.2);}
    if(a==='walk'){const step=Math.sin(t*6)*.32;pose('leftUpperLeg',step);pose('rightUpperLeg',-step);pose('leftLowerLeg',Math.max(0,-step));pose('rightLowerLeg',Math.max(0,step));pose('leftUpperArm',-step*.4,0,-1.2);pose('rightUpperArm',step*.4,0,1.2);root.position.z=Math.sin(t*.35)*.6;}
    const p=playing.current,w=mouthAt(p?.track||[],p?.audio.currentTime||0,!!p&&!p.audio.paused&&!p.audio.ended&&!p.audio.seeking&&p.audio.readyState>=2);for(const [name,value]of Object.entries(w))vrm!.expressionManager?.setValue(name,value);
    const mouth=Object.keys(w).reduce((sum,name)=>sum+(vrm!.expressionManager?.getValue(name)||0),0)>.01?'发音中':'嘴部静止';if(mouthState.current&&mouthState.current.textContent!==mouth)mouthState.current.textContent=mouth;
    vrm!.expressionManager?.setValue('happy',a==='happy'?.45:0);vrm!.expressionManager?.setValue('blink',Math.max(0,1-Math.abs(t%4.8-.14)/.10));vrm!.update(dt);controls.update();renderer.render(scene,camera);
   };setReady(true);draw();
  })().catch(()=>{if(!disposed)setError('人物模型加载失败，请重试。');});
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);if(vrm)VRMUtils.deepDispose(vrm.scene);floor.geometry.dispose();(floor.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <section aria-label="完整骨骼人物预览" className="mx-auto max-w-6xl space-y-4 p-6"><div><p className="text-sm text-indigo-600">人物模型与表情</p><h1 className="text-2xl font-semibold">完整骨骼人物预览</h1><p className="mt-2 text-sm text-slate-600">拖动旋转、滚轮缩放。可观察面部、头发、衣服和关节动作。</p></div><div className="overflow-hidden rounded-2xl border bg-[#f2f0ec]"><div ref={host} className="h-[580px] w-full"/><div className="flex flex-wrap gap-2 border-t bg-white p-4">{(Object.keys(labels) as Action[]).map(a=><button key={a} disabled={!ready} aria-pressed={action===a} onClick={()=>{motion.current=a;setAction(a);}} className={'rounded-lg border px-4 py-2 '+(action===a?'bg-indigo-600 text-white':'bg-white')}>{labels[a]}</button>)}<button onClick={()=>{fullBody.current=!fullBody.current;reset.current++;}} className="rounded-lg border px-4 py-2">切换半身 / 全身</button><button onClick={()=>{reset.current++;motion.current='idle';setAction('idle');}} className="rounded-lg border px-4 py-2">重置视角</button></div></div><output ref={mouthState} aria-label="人物口型状态">嘴部静止</output><p role="status">{ready?'骨骼人物已就绪':'正在加载人物模型…'}</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<p className="text-xs text-slate-500">模型：VRM1_Constraint_Twist_Sample © 2022 pixiv Inc. · <a href="https://vrm.dev/licenses/1.0/" className="underline">VRM Public License 1.0</a> · 第三方骨骼与表情验证资产，尚非20个原图的定制成品。</p></section>;
}
