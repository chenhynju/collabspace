"use client";
import {useEffect,useRef,useState} from 'react';
import {characters,mouthAt,type VisemeFrame} from './character-catalog';
export type CharacterPlayback={track:VisemeFrame[];audio:HTMLAudioElement};

/** Real VRM assets only. A portrait fallback must never claim to be animated 3D. */
export default function AvatarPreview({active=true,vrmUrl,playback,characterId='lan-v1'}:{speaking?:boolean;active?:boolean;vrmUrl?:string;playback?:CharacterPlayback|null;characterId?:string}){
 const character=characters.find(c=>c.id===characterId)||characters[0];
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),current=useRef(playback);current.current=playback;
 useEffect(()=>{
  setError('');setLoaded(false);if(!active||!vrmUrl||!host.current)return;
  let disposed=false,frame=0,renderer:any,scene:any,vrm:any,observer:ResizeObserver|undefined;const element=host.current;
  const disposeScene=(root:any)=>root?.traverse((o:any)=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach((m:any)=>{if(m){Object.values(m).forEach((v:any)=>{if(v?.isTexture)v.dispose();});m.dispose();}});});
  const contextLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(frame);setLoaded(false);setError('3D渲染已停止，显示静态形象。请重新打开预览。');};
  void(async()=>{
   const [THREE,{GLTFLoader},{VRMLoaderPlugin}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('@pixiv/three-vrm')]);if(disposed)return;
   const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync(vrmUrl);if(disposed){disposeScene(gltf.scene);return;}
   vrm=gltf.userData.vrm;if(!vrm){disposeScene(gltf.scene);throw Error('不是有效VRM模型');}
   scene=new THREE.Scene();scene.background=new THREE.Color('#f3f0fa');scene.add(vrm.scene);vrm.scene.rotation.y=Math.PI;
   const camera=new THREE.PerspectiveCamera(30,1,.1,30);const head=vrm.humanoid?.getNormalizedBoneNode('head');const at=new THREE.Vector3(0,1.45,0);if(head)head.getWorldPosition(at);camera.position.set(at.x,at.y,at.z+1.8);camera.lookAt(at.x,at.y-.12,at.z);
   renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.domElement.addEventListener('webglcontextlost',contextLost);element.appendChild(renderer.domElement);
   scene.add(new THREE.HemisphereLight(0xffffff,0x7c7490,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,3,4);scene.add(light);
   observer=new ResizeObserver(()=>{const w=element.clientWidth;if(!w)return;renderer.setSize(w,300);camera.aspect=w/300;camera.updateProjectionMatrix();});observer.observe(element);
   const clock=new THREE.Clock();let last=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
   const animate=()=>{if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden||clock.elapsedTime-last<1/30){clock.getDelta();return;}const dt=Math.min(clock.getDelta(),.1),t=clock.elapsedTime;last=t;const p=current.current,w=mouthAt(p?.track||[],p?.audio.currentTime||0,!!p&&!p.audio.paused&&!p.audio.ended&&!document.hidden);Object.entries(w).forEach(([k,v])=>vrm.expressionManager?.setValue(k,v));
    if(!reduced.matches){const blink=Math.max(0,1-Math.abs((t%4.7)-.12)/.09);vrm.expressionManager?.setValue('blink',blink);const neck=vrm.humanoid?.getNormalizedBoneNode('neck');if(neck)neck.rotation.y=Math.sin(t*.35)*.025;}else vrm.expressionManager?.setValue('blink',0);
    vrm.update(dt);renderer.render(scene,camera);
   };setLoaded(true);animate();
  })().catch(()=>{if(!disposed){setLoaded(false);setError('模型无法加载，显示静态形象。');}});
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();disposeScene(scene);renderer?.domElement.removeEventListener('webglcontextlost',contextLost);renderer?.dispose();renderer?.domElement.remove();};
 },[active,vrmUrl]);
 return <div className="overflow-hidden rounded-2xl border border-violet-100 bg-violet-50"><div className="relative h-[300px]" aria-label={vrmUrl?'VRM角色预览':'Agent静态形象'}>{(!loaded||!vrmUrl)&&<img src={character.poster} alt={character.name+'原创Agent静态形象'} className="h-full w-full object-cover object-[center_25%]"/>}<div ref={host} className={loaded?'absolute inset-0':'hidden'}/></div><p className="px-3 py-2 text-xs text-slate-500">{loaded?'本地VRM预览；仅有真实口型轨道时驱动嘴型。':'静态角色外观稿 · 可动3D模型尚未交付'}</p>{error&&<p role="alert" className="px-3 pb-2 text-xs text-red-700">{error}</p>}</div>;
}
