import * as T from './vendor/three.module.js';
export function createBike(){
  const root=new T.Group(),body=new T.Group();root.add(body);
  const mat={black:new T.MeshStandardMaterial({color:0x202820,roughness:.65}),tire:new T.MeshStandardMaterial({color:0x181e1b,roughness:1}),silver:new T.MeshStandardMaterial({color:0x9ba89f,metalness:.72,roughness:.32}),paint:new T.MeshStandardMaterial({color:0xb69c59,metalness:.3,roughness:.48}),seat:new T.MeshStandardMaterial({color:0x30352e,roughness:1}),cloth:new T.MeshStandardMaterial({color:0x53604d,roughness:1}),helmet:new T.MeshStandardMaterial({color:0xe1d9b9,roughness:.47}),visor:new T.MeshStandardMaterial({color:0x233b3c,metalness:.35,roughness:.2}),red:new T.MeshStandardMaterial({color:0xd25731,emissive:0x8e2918,emissiveIntensity:.5}),lamp:new T.MeshStandardMaterial({color:0xffefbf,emissive:0xffd78b,emissiveIntensity:.45})};
  function beveled(w,h,d){
    const r=Math.min(w,h,d)*.16,s=new T.Shape(),a=-w/2,b=-h/2;
    s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+h-r);s.quadraticCurveTo(a+w,b+h,a+w-r,b+h);s.lineTo(a+r,b+h);s.quadraticCurveTo(a,b+h,a,b+h-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
    const g=new T.ExtrudeGeometry(s,{depth:Math.max(.001,d-2*r),bevelEnabled:true,bevelSize:r*.5,bevelThickness:r,bevelSegments:2,curveSegments:4,steps:1});g.translate(0,0,-d/2+r);g.computeVertexNormals();return g;
  }
  function box(w,h,d,x,y,z,m,parent=body){const a=new T.Mesh(h>.06&&w>.08&&d>.07?beveled(w,h,d):new T.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;}
  function sphere(r,x,y,z,m,sx=1,sy=1,sz=1,parent=body){const a=new T.Mesh(new T.SphereGeometry(r,28,18),m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.castShadow=true;parent.add(a);return a;}
  function bar(a,b,r,m,parent=body){const va=new T.Vector3(...a),vb=new T.Vector3(...b),v=vb.clone().sub(va);const mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),8),m);mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.castShadow=true;parent.add(mesh);return mesh;}
  const wheels=[];
  for(const z of [-.77,.85]){
    const wheel=new T.Group();wheel.position.set(0,.36,z);body.add(wheel);wheels.push(wheel);
    const tire=new T.Mesh(new T.TorusGeometry(.285,.09,12,48),mat.tire);tire.rotation.y=Math.PI/2;wheel.add(tire);
    const tread=new T.InstancedMesh(new T.BoxGeometry(.12,.012,.048),mat.tire,36),dummy=new T.Object3D();for(let j=0;j<36;j++){const angle=j/36*Math.PI*2;dummy.position.set(0,Math.cos(angle)*.373,Math.sin(angle)*.373);dummy.rotation.x=angle;dummy.updateMatrix();tread.setMatrixAt(j,dummy.matrix);}wheel.add(tread);
    const rim=new T.Mesh(new T.TorusGeometry(.235,.022,5,24),mat.silver);rim.rotation.y=Math.PI/2;wheel.add(rim);
    const hub=new T.Mesh(new T.CylinderGeometry(.055,.055,.16,12),mat.silver);hub.rotation.z=Math.PI/2;wheel.add(hub);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2;bar([0,0,0],[0,Math.sin(a)*.24,Math.cos(a)*.24],.008,mat.silver,wheel);}
    const disc=new T.Mesh(new T.CylinderGeometry(.14,.14,.012,20),mat.silver);disc.rotation.z=Math.PI/2;disc.position.x=.081;wheel.add(disc);
  }
  for(const side of [-1,1]){
    bar([side*.14,.39,-.77],[side*.14,.79,.1],.035,mat.black);
    bar([side*.14,.79,.1],[side*.14,.45,.5],.035,mat.black);
    bar([side*.14,.45,.5],[side*.14,.39,-.77],.03,mat.black);
    bar([side*.13,.37,.85],[side*.13,1.1,.62],.033,mat.silver);
    bar([side*.16,.7,-.55],[side*.16,.96,-.3],.03,mat.silver);
  }
  sphere(.25,0,.62,.02,mat.silver,1,.9,1.1);for(let y=.51;y<.76;y+=.045)box(.44,.014,.27,0,y,.12,mat.black);
  bar([.22,.55,.15],[.26,.44,-.6],.038,mat.silver);box(.15,.15,.58,.28,.48,-.52,mat.silver);
  const tank=sphere(.31,0,1.0,.22,mat.paint,.79,.68,1.4);tank.rotation.x=-.12;
  box(.38,.11,.64,0,.99,-.32,mat.seat);box(.42,.08,.35,0,.94,-.72,mat.paint);
  box(.36,.08,.38,0,.77,.86,mat.paint);box(.32,.15,.08,0,.93,-.9,mat.red);
  box(.27,.19,.04,0,.77,-.95,mat.helmet);box(.39,.25,.15,0,1.1,.72,mat.black);box(.25,.16,.025,0,1.11,.808,mat.lamp);
  // Adventure windscreen and instrument cluster.
  const glass=new T.Mesh(new T.BoxGeometry(.39,.32,.025),new T.MeshStandardMaterial({color:0xb6cec2,transparent:true,opacity:.36,roughness:.22,metalness:.12}));glass.position.set(0,1.35,.66);glass.rotation.x=.22;body.add(glass);
  const handle=new T.Group();handle.position.set(0,1.2,.52);body.add(handle);bar([-.42,0,-.08],[.42,0,-.08],.022,mat.silver,handle);
  for(const side of [-1,1]){bar([side*.29,0,-.08],[side*.45,0,-.1],.035,mat.black,handle);bar([side*.32,0,-.08],[side*.43,.24,.04],.012,mat.silver,handle);sphere(.075,side*.43,.27,.04,mat.black,1.4,.65,.4,handle);}
  const rider=new T.Group();body.add(rider);
  const torso=sphere(.3,0,1.43,-.19,mat.cloth,.81,1.38,.66,rider);torso.rotation.x=.24;
  sphere(.13,0,1.16,-.34,mat.black,1.25,1,1.5,rider);
  const helmet=sphere(.205,0,1.97,-.035,mat.helmet,.93,1.08,1,rider);sphere(.18,0,1.99,.08,mat.visor,.9,.6,.65,rider);
  const helmetRim=new T.Mesh(new T.TorusGeometry(.177,.013,6,30),mat.black);helmetRim.rotation.x=Math.PI/2;helmetRim.position.set(0,1.86,-.02);rider.add(helmetRim);
  box(.17,.055,.12,0,2.175,-.03,mat.black,rider);
  box(.12,.07,.025,0,1.99,-.224,mat.red,rider);
  for(const side of [-1,1]){
    bar([side*.2,1.65,-.14],[side*.31,1.38,.1],.085,mat.cloth,rider);bar([side*.31,1.38,.1],[side*.4,1.22,.44],.065,mat.cloth,rider);sphere(.066,side*.4,1.22,.44,mat.black,1,1,1,rider);
    bar([side*.13,1.15,-.28],[side*.29,.86,.17],.1,mat.black,rider);bar([side*.29,.86,.17],[side*.26,.43,-.12],.078,mat.black,rider);box(.15,.12,.29,side*.26,.4,-.04,mat.black,rider);
    box(.33,.38,.48,side*.39,.84,-.65,mat.cloth);box(.35,.045,.49,side*.39,1.05,-.65,mat.black);
  }
  box(.29,.38,.12,0,1.52,-.43,mat.black,rider);
  const stitch=new T.MeshStandardMaterial({color:0xbab49b,roughness:.95});
  for(const side of [-1,1]){bar([side*.095,1.69,-.51],[side*.095,1.36,-.51],.009,stitch,rider);box(.07,.04,.02,side*.095,1.39,-.51,mat.silver,rider);sphere(.055,side*.21,1.67,-.16,mat.black,1.3,.7,1,rider);box(.035,.20,.025,side*.46,.85,-.902,stitch);}
  // Suspension coils, luggage latches and a rear rack add readable mechanical detail.
  for(const side of [-1,1]){for(let i=0;i<8;i++){const coil=new T.Mesh(new T.TorusGeometry(.05,.009,5,12),mat.silver);coil.rotation.x=Math.PI/2;coil.position.set(side*.16,.73+i*.023,-.48+i*.017);body.add(coil);}box(.055,.035,.03,side*.4,1.09,-.85,mat.silver);}
  bar([-.28,1.09,-.74],[.28,1.09,-.74],.016,mat.silver);bar([-.28,1.09,-.9],[.28,1.09,-.9],.016,mat.silver);
  return {root,body,rider,wheels,handle,mat};
}
