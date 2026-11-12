import * as THREE from 'three';
export const motionLooks=[
 {id:'female-02-v1',name:'知夏',poster:'/personas/agent-female-02-v1.png',skin:'#e9b38e',hair:'#54362b',coat:'#929984',shirt:'#fff3e2',style:'bob',glasses:true},
 {id:'male-01-v1',name:'知行',poster:'/personas/agent-male-01-v1.png',skin:'#e7b493',hair:'#302721',coat:'#c7c6d1',shirt:'#25344d',style:'short',glasses:false},
 {id:'female-06-v1',name:'明悦',poster:'/personas/agent-female-06-v1.png',skin:'#b77d57',hair:'#30221e',coat:'#753e69',shirt:'#fff1dc',style:'curly',glasses:false},
] as const;
export type MotionLook=typeof motionLooks[number];
/** Original procedural interpretation of the existing owned portraits, not photo reconstruction. */
export function createPortraitRig(look:MotionLook){
 const bot=new THREE.Group(),body=new THREE.Group();bot.add(body);
 const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.65});
 const skin=material(look.skin),hair=material(look.hair),suit=material(look.coat),shirt=material(look.shirt),pants=material('#303848'),shoe=material('#242735'),white=material('#fff9ef'),iris=material('#513928'),pupil=material('#1d1e27'),lip=material('#a85e57');
 const mesh=(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const ball=(p:THREE.Object3D,r:number,m:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>mesh(p,new THREE.SphereGeometry(r,20,14),m,x,y,z,sx,sy,sz);
 mesh(body,new THREE.CapsuleGeometry(.28,.45,6,20),suit,0,1.12,0,1,.98,.8);
 mesh(body,new THREE.BoxGeometry(.24,.43,.04),shirt,0,1.25,.225);
 for(const side of [-1,1]){const lapel=mesh(body,new THREE.BoxGeometry(.09,.42,.035),suit,side*.15,1.27,.25);lapel.rotation.z=side*.22;ball(body,.025,pupil,side*.18,1.08,.247);}
 mesh(body,new THREE.CylinderGeometry(.09,.10,.22,16),skin,0,1.59,0);
 const head=new THREE.Group();head.position.y=1.86;body.add(head);
 ball(head,.32,skin,0,0,0,.88,1.13,.87);
 for(const side of [-1,1]){ball(head,.065,skin,side*.28,-.01,0,.6,1,.65);ball(head,.064,white,side*.105,.02,.25,1,.72,.35);ball(head,.035,iris,side*.105,.02,.271,1,1,.3);ball(head,.018,pupil,side*.105,.02,.28,1,1,.3);ball(head,.008,white,side*.095,.03,.286);const brow=mesh(head,new THREE.CapsuleGeometry(.012,.09,3,8),hair,side*.105,.104,.25);brow.rotation.z=Math.PI/2+side*.1;}
 ball(head,.04,skin,0,-.045,.278,.65,1,1.3);
 const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.073,-.13,.253),new THREE.Vector3(0,-.145,.267),new THREE.Vector3(.073,-.13,.253)]);mesh(head,new THREE.TubeGeometry(smile,12,.012,6,false),lip,0,0,0);
 mesh(head,new THREE.SphereGeometry(.332,24,16,0,Math.PI*2,0,Math.PI*.47),hair,0,.075,-.012,.92,1.03,.9);
 if(look.style==='bob'){
  for(const side of [-1,1])mesh(head,new THREE.CapsuleGeometry(.095,.28,5,12),hair,side*.26,-.065,-.07,.8,1,1.7);
  ball(head,.28,hair,0,-.06,-.18,1,1.15,.5);
  for(let i=0;i<6;i++){const strand=mesh(head,new THREE.CapsuleGeometry(.035,.21,4,8),hair,-.19+i*.045,.19-i*.025,.215);strand.rotation.z=-.55;}
 }else if(look.style==='short'){
  for(let i=0;i<7;i++){const tuft=ball(head,.10,hair,-.2+i*.065,.28+Math.sin(i*.5)*.035,.08,1,1.1,1.6);tuft.rotation.z=-.45;}
  for(const side of [-1,1])mesh(head,new THREE.BoxGeometry(.045,.13,.12),hair,side*.265,.09,-.03);
 }else{
  for(let row=0;row<5;row++){const theta=.16+row*.34;for(let j=0;j<14;j++){const phi=j/14*Math.PI*2+row*.21;if(Math.sin(phi)>.25&&theta>1.05)continue;const radius=.335;ball(head,.066,hair,Math.sin(theta)*Math.cos(phi)*radius,Math.cos(theta)*radius+.055,Math.sin(theta)*Math.sin(phi)*radius-.025,1,1.08,1);}}
 }
 if(look.glasses){const frame=material('#8d7560');for(const side of [-1,1])mesh(head,new THREE.TorusGeometry(.087,.009,6,32),frame,side*.108,.023,.293,1,.86,1);mesh(head,new THREE.BoxGeometry(.06,.012,.012),frame,0,.033,.297);for(const side of [-1,1])mesh(head,new THREE.BoxGeometry(.012,.012,.22),frame,side*.205,.03,.18);}
 function arm(x:number){const joint=new THREE.Group();joint.position.set(x,1.43,0);body.add(joint);mesh(joint,new THREE.CapsuleGeometry(.085,.37,5,12),suit,0,-.23,0);ball(joint,.075,skin,0,-.49,0,.8,1.15,.8);return joint;}
 function leg(x:number){const joint=new THREE.Group();joint.position.set(x,.77,0);body.add(joint);mesh(joint,new THREE.CapsuleGeometry(.095,.40,5,12),pants,0,-.24,0);mesh(joint,new THREE.BoxGeometry(.20,.13,.31),shoe,0,-.65,.065);return joint;}
 const leftArm=arm(-.36),rightArm=arm(.36),leftLeg=leg(-.145),rightLeg=leg(.145);
 return {bot,body,head,leftArm,rightArm,leftLeg,rightLeg,suit};
}
