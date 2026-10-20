import * as T from './vendor/three.module.js';
import {noise,hash} from './simulation.js';

export function createGrassGeometry(){
  const positions=[],uvs=[];
  // A tuft of five narrow, curved blades, rather than broad triangular spikes.
  for(let b=0;b<5;b++){
    const a=b*2.399,h=.16+hash(b,83)*.20,w=.009+hash(b,64)*.014;
    const ox=Math.cos(a)*.09,oz=Math.sin(a)*.09,dx=Math.cos(a),dz=Math.sin(a);
    const points=[];
    for(let j=0;j<3;j++){const t=j/2,cx=ox+dx*t*t*.10,cz=oz+dz*t*t*.10;points.push([cx-dz*w*(1-t),h*t,cz+dx*w*(1-t)],[cx+dz*w*(1-t),h*t,cz-dx*w*(1-t)]);}
    for(const i of [0,1,2,1,3,2,2,3,4,3,5,4]){positions.push(...points[i]);uvs.push(i%2,Math.floor(i/2)/2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();return geo;
}

export function createMountains(){
  const root=new T.Group(),p=[],colors=[],indices=[],angles=240,radii=[1500,2000,2600,3300,4100,5000,6200,7700,9300];
  const color=new T.Color();
  for(let r=0;r<radii.length;r++)for(let i=0;i<=angles;i++){
    const a=i/angles*Math.PI*2,x=Math.cos(a),z=Math.sin(a),rad=radii[r];
    const ridge=Math.pow(noise(x*4.7+21,z*4.7+19),1.3)*360+noise(x*13+7,z*13)*160+noise(x*39,z*39)*55;
    const profile=[-35,-16,.13,.61,1,.6,.38,.55,.2][r];
    const y=r<2?profile:ridge*profile+noise(x*17+r*3,z*17+r*2)*95;
    p.push(x*rad,y,z*rad);
    color.setHSL(.56-r*.004,.17+noise(x*8+r,z*8)*.05,.105+r*.009+noise(x*25+r,z*25)*.035);
    if(r===0)color.set(0x7f895e);else if(r===1)color.set(0x899473);
    colors.push(color.r,color.g,color.b);
    if(r<radii.length-1&&i<angles){const k=r*(angles+1)+i;indices.push(k,k+1,k+angles+1,k+1,k+angles+2,k+angles+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));mesh.frustumCulled=false;root.add(mesh);
  const floor=new T.Mesh(new T.CircleGeometry(9600,96),new T.MeshStandardMaterial({color:0x8c946d,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-40;root.add(floor);
  return root;
}

export function createFlag(texture){
  const group=new T.Group();group.userData.dynamic=true;
  const metal=new T.MeshStandardMaterial({color:0xb8b9ad,metalness:.75,roughness:.27});
  const pole=new T.Mesh(new T.CylinderGeometry(.055,.095,8.5,12),metal);pole.position.y=4.25;pole.castShadow=true;group.add(pole);
  const base=new T.Mesh(new T.CylinderGeometry(.38,.52,.32,12),new T.MeshStandardMaterial({color:0x9b9880,roughness:1}));base.position.y=.16;group.add(base);
  const ball=new T.Mesh(new T.SphereGeometry(.13,12,8),metal);ball.position.y=8.55;group.add(ball);
  const geo=new T.PlaneGeometry(4.6,2.3,24,12);geo.translate(2.31,0,0);
  const flag=new T.Mesh(geo,new T.MeshStandardMaterial({map:texture,roughness:.86,side:T.DoubleSide,metalness:0}));flag.position.y=7.15;flag.rotation.y=Math.PI+.12;flag.castShadow=true;flag.frustumCulled=false;flag.userData.rest=geo.attributes.position.array.slice();group.add(flag);
  group.userData.flag=flag;return group;
}

export function createGoat(seed,batch,furTexture,shadowMaterial){
  const goat=new T.Group();goat.userData.dynamic=true;
  const palettes=[0xd2c6aa,0xe2dbc8,0x8a6d4a,0xa09278,0xc7b491];
  const fur=new T.MeshStandardMaterial({color:palettes[Math.abs(seed)%palettes.length],roughness:1,bumpMap:furTexture,bumpScale:.028});
  const dark=new T.MeshStandardMaterial({color:0x2d2a22,roughness:.9}),horn=new T.MeshStandardMaterial({color:0x7c725a,roughness:.85}),eye=new T.MeshStandardMaterial({color:0x130f0b,roughness:.28}),inner=new T.MeshStandardMaterial({color:0xa8876a,roughness:1});
  const bodyRoot=new T.Group(),parts=new T.Group();bodyRoot.add(parts);goat.add(bodyRoot);
  const head=new T.Group(),headParts=new T.Group();head.add(headParts);head.position.set(.51,1.03,0);head.rotation.z=-.12;goat.add(head);
  function ellipsoid(parent,r,pos,scale,mat){const o=new T.Mesh(new T.SphereGeometry(r,18,12),mat);o.position.set(...pos);o.scale.set(...scale);o.castShadow=true;parent.add(o);return o;}
  function segment(parent,a,b,r1,r2,mat){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const o=new T.Mesh(new T.CylinderGeometry(r2,r1,delta.length(),10),mat);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());o.castShadow=true;parent.add(o);return o;}
  ellipsoid(parts,1,[0,.87,0],[.60,.31,.245],fur);
  ellipsoid(parts,1,[-.32,.86,0],[.25,.32,.255],fur);
  ellipsoid(parts,1,[.35,.94,0],[.25,.35,.23],fur);
  segment(parts,[.36,.83,0],[.55,1.17,0],.19,.13,fur);
  for(const x of [-.38,.36])for(const z of [-.18,.18]){
    const knee=x<0?x+.12:x-.04;
    segment(parts,[x,.83,z],[knee,.43,z],.074,.047,fur);segment(parts,[knee,.43,z],[x+.02,.085,z],.047,.031,fur);
    for(const dz of [-.023,.023]){const hoof=new T.Mesh(new T.BoxGeometry(.13,.09,.039),dark);hoof.position.set(x+.045,.05,z+dz);parts.add(hoof);}
  }
  const tailPath=new T.CatmullRomCurve3([new T.Vector3(-.53,1,0),new T.Vector3(-.72,1.16,0),new T.Vector3(-.77,1.29,.015)]);
  parts.add(new T.Mesh(new T.TubeGeometry(tailPath,7,.045,6,false),fur));
  ellipsoid(headParts,1,[.08,.13,0],[.14,.23,.145],fur);
  ellipsoid(headParts,1,[.21,-.015,0],[.19,.11,.105],fur);
  ellipsoid(headParts,1,[.33,-.035,0],[.045,.06,.09],dark);
  for(const side of [-1,1]){
    const ear=ellipsoid(headParts,1,[-.015,.19,side*.235],[.15,.045,.16],fur);ear.rotation.x=side*.3;ear.rotation.y=side*.35;
    const inside=ellipsoid(headParts,1,[.01,.202,side*.25],[.105,.018,.115],inner);inside.rotation.x=side*.3;
    ellipsoid(headParts,.026,[.15,.16,side*.122],[1,.77,.65],eye);
    const curve=new T.CatmullRomCurve3([new T.Vector3(-.01,.28,side*.095),new T.Vector3(-.035,.5,side*.13),new T.Vector3(-.18,.69,side*.16),new T.Vector3(-.35,.76,side*.18),new T.Vector3(-.43,.74,side*.18)]);
    const hornMesh=new T.Mesh(new T.TubeGeometry(curve,14,.033,7,false),horn);hornMesh.castShadow=true;headParts.add(hornMesh);
  }
  const beard=new T.Mesh(new T.ConeGeometry(.06,.25,9),fur);beard.position.set(.19,-.21,0);beard.rotation.z=Math.PI-.15;headParts.add(beard);
  // Merge body and head independently, keeping a movable neck with few draw calls.
  batch(bodyRoot);batch(head);
  const shadow=new T.Mesh(new T.PlaneGeometry(2,1.3),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;goat.add(shadow);
  const scale=.9+hash(seed,31)*.22;goat.scale.setScalar(scale);goat.rotation.y=-.4+hash(seed,51)*1.1;
  goat.userData.head=head;goat.userData.phase=hash(seed,37)*Math.PI*2;return goat;
}

export function createContactShadow(){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(25,30,16,.34)');g.addColorStop(.45,'rgba(25,30,16,.22)');g.addColorStop(1,'rgba(25,30,16,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  return new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}
