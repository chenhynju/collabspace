'use client';
import {useEffect,useRef,useState} from 'react';

export default function AvatarPreview({speaking=false,active=true,vrmUrl}:{speaking?:boolean;active?:boolean;vrmUrl?:string}){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 const motion=useRef(speaking);motion.current=speaking;
 const level=useRef(0);
 useEffect(()=>{const listener=(event:Event)=>{level.current=(event as CustomEvent<number>).detail||0;};window.addEventListener('collabspace:voice-level',listener);return()=>window.removeEventListener('collabspace:voice-level',listener);},[]);
 useEffect(()=>{
  if(!active||!host.current)return;
  let disposed=false,frame=0,renderer:any,scene:any,vrm:any,observer:ResizeObserver|undefined;
  const element=host.current;
  const resources:any[]=[];
  void (async()=>{
   const THREE=await import('three');if(disposed)return;
   scene=new THREE.Scene();scene.background=new THREE.Color('#eef2ff');
   const camera=new THREE.PerspectiveCamera(32,1,0.1,100);camera.position.set(0,1.3,4.4);camera.lookAt(0,1.05,0);
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));element.appendChild(renderer.domElement);
   scene.add(new THREE.HemisphereLight(0xffffff,0x556688,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,3,4);scene.add(light);
   const head=new THREE.Group();head.position.y=1.4;scene.add(head);
   const sphere=(parent:any,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const g=new THREE.SphereGeometry(1,24,16),m=new THREE.MeshStandardMaterial({color,roughness:0.65});resources.push(g,m);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;};
   sphere(head,0xffcfad,0,0,0,0.43,0.48,0.38);sphere(head,0x26334d,0,0.3,-0.04,0.44,0.24,0.37);
   sphere(head,0x26334d,-0.15,0.03,0.35,0.04,0.055,0.03);sphere(head,0x26334d,0.15,0.03,0.35,0.04,0.055,0.03);
   const mouth=sphere(head,0x9b3448,0,-0.18,0.36,0.12,0.025,0.025);
   sphere(scene,0x6366f1,0,0.54,0,0.55,0.5,0.29);
   if(vrmUrl){
    const [{GLTFLoader},{VRMLoaderPlugin}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('@pixiv/three-vrm')]);if(disposed)return;
    const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
    const gltf=await loader.loadAsync(vrmUrl);vrm=gltf.userData.vrm;
    if(disposed){gltf.scene.traverse((o:any)=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach((m:any)=>m?.dispose());});return;}
    if(!vrm)throw Error('不是有效VRM模型');
    head.visible=false;scene.children.filter((o:any)=>o.isMesh).forEach((o:any)=>o.visible=false);scene.add(vrm.scene);vrm.scene.rotation.y=Math.PI;
   }
   observer=new ResizeObserver(()=>{if(!renderer)return;const width=element.clientWidth;renderer.setSize(width,230);camera.aspect=width/230;camera.updateProjectionMatrix();});observer.observe(element);
   const clock=new THREE.Clock();const animate=()=>{if(disposed)return;frame=requestAnimationFrame(animate);const dt=clock.getDelta(),t=clock.elapsedTime,amount=motion.current?Math.abs(Math.sin(t*15))*.5:level.current;head.rotation.y=Math.sin(t*.5)*.06;mouth.scale.y=.025+amount*.18;vrm?.expressionManager?.setValue('aa',amount);vrm?.update(dt);renderer.render(scene,camera);};animate();
  })().catch(()=>{if(!disposed)setError('3D预览不可用，请检查WebGL或模型文件');});
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();scene?.traverse((o:any)=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach((m:any)=>{if(m){Object.values(m).forEach((v:any)=>{if(v?.isTexture)v.dispose();});m.dispose();}});});resources.forEach(r=>r.dispose());renderer?.dispose();renderer?.domElement.remove();};
 },[active,vrmUrl]);
 return <div><div ref={host} aria-label="3D卡通预览" className="h-[230px] w-full overflow-hidden rounded-xl"/>{error&&<p role="alert">{error}</p>}</div>;
}
