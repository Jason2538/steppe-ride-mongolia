import * as T from './vendor/three.module.js';

// Original expedition wagon, metres, forward +Z. No third-party model assets.
export function createCar(){
  const root=new T.Group(),body=new T.Group(),cabin=new T.Group();root.add(body);body.add(cabin);
  const paint=new T.MeshStandardMaterial({color:0x788d72,metalness:.48,roughness:.3});
  const trim=new T.MeshStandardMaterial({color:0x252c29,roughness:.78});
  const silver=new T.MeshStandardMaterial({color:0xaab4af,metalness:.8,roughness:.25});
  const glass=new T.MeshStandardMaterial({color:0x70928f,metalness:.25,roughness:.12,transparent:true,opacity:.4,depthWrite:false});
  const seat=new T.MeshStandardMaterial({color:0x303934,roughness:.95});
  const lamp=new T.MeshStandardMaterial({color:0xffefcf,emissive:0xffdb91,emissiveIntensity:.8});
  const tail=new T.MeshStandardMaterial({color:0xd44932,emissive:0xad2418,emissiveIntensity:.5});
  function box(w,h,d,x,y,z,mat,parent=body,r=.035){
    r=Math.min(r,w/4,h/4,d/4);const shape=new T.Shape(),a=-w/2,b=-h/2;
    shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);shape.quadraticCurveTo(a+w,b,a+w,b+r);shape.lineTo(a+w,b+h-r);shape.quadraticCurveTo(a+w,b+h,a+w-r,b+h);shape.lineTo(a+r,b+h);shape.quadraticCurveTo(a,b+h,a,b+h-r);shape.lineTo(a,b+r);shape.quadraticCurveTo(a,b,a+r,b);
    const g=new T.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r*.45,bevelSegments:2,curveSegments:3,steps:1});g.translate(0,0,-d/2+r);
    const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  box(1.82,.49,4.25,0,.8,0,paint,body,.08);
  box(1.87,.21,4.35,0,.48,0,trim); // lower sill
  box(1.7,.12,1.18,0,1.08,1.43,paint,body,.045);
  box(1.68,.12,2.53,0,1.83,-.38,paint,cabin,.04);
  box(1.65,.63,.025,0,1.47,.81,glass,cabin);
  box(1.64,.56,.025,0,1.47,-1.64,glass,cabin);
  for(const side of [-1,1]){
    box(.03,.58,2.3,side*.85,1.48,-.4,glass,cabin);
    for(const z of [.82,-.3,-1.65])box(.075,.73,.075,side*.855,1.46,z,paint,cabin);
    box(.045,.07,2.48,side*.86,1.16,-.4,paint);
    box(.05,.018,2.43,side*.88,1.12,-.4,silver);
    for(const z of [.18,-.96]){
      box(.025,.39,.017,side*.925,.88,z-.49,trim);
      box(.035,.043,.17,side*.934,1.055,z-.2,silver);
    }
    box(.2,.15,.29,side*1.01,1.32,.69,trim,cabin);
    box(.013,.11,.22,side*1.117,1.33,.67,silver,cabin);
    box(.36,.17,.04,side*.59,.92,2.16,lamp);
    box(.22,.31,.04,side*.72,.88,-2.16,tail);
    box(.08,.055,2.28,side*.61,1.95,-.36,trim,cabin);
    box(.14,.07,3.0,side*.92,.4,-.05,silver);
  }
  box(.83,.24,.045,0,.87,2.17,trim);
  for(let i=0;i<6;i++)box(.035,.17,.035,(i-2.5)*.12,.88,2.2,silver);
  box(1.84,.12,.12,0,.56,2.22,silver);box(1.84,.12,.12,0,.56,-2.22,silver);
  box(.43,.12,.018,0,.78,-2.16,silver);
  // Seats, dashboard, console, and steering wheel remain visible in the cabin view.
  for(const x of [-.43,.43]){
    box(.55,.18,.6,x,.82,-.21,seat);
    const back=box(.54,.59,.16,x,1.1,-.52,seat);back.rotation.x=.1;
    box(.32,.19,.13,x,1.49,-.57,seat);
  }
  box(1.5,.26,.42,0,1.04,.51,trim);box(.29,.25,.85,0,.85,.05,trim);
  box(.29,.16,.025,0,1.17,.275,new T.MeshStandardMaterial({color:0x0f262b,emissive:0x203c3b,emissiveIntensity:.6}));
  const steering=new T.Group();steering.position.set(.43,1.12,.6);steering.rotation.x=-.35;body.add(steering);
  const ring=new T.Mesh(new T.TorusGeometry(.17,.018,8,28),trim);steering.add(ring);
  box(.3,.026,.028,0,0,0,silver,steering);box(.065,.17,.035,0,-.07,0,trim,steering);
  box(.49,.18,.11,.43,1.19,.81,trim);
  const dialMat=new T.MeshStandardMaterial({color:0xe1e8d3,emissive:0x405b43,emissiveIntensity:.4,side:T.DoubleSide});
  for(const x of [.31,.55]){
    const dial=new T.Mesh(new T.CircleGeometry(.064,24),dialMat);dial.position.set(x,1.2,.745);body.add(dial);
    const needle=box(.005,.048,.005,x,1.21,.738,tail);needle.rotation.z=.6;
  }
  const wheels=[],frontPivots=[];
  const tireGeo=new T.CylinderGeometry(.4,.4,.24,32),rimGeo=new T.CylinderGeometry(.245,.245,.255,24);
  tireGeo.rotateZ(Math.PI/2);rimGeo.rotateZ(Math.PI/2);
  for(const x of [-.86,.86])for(const z of [-1.33,1.34]){
    const pivot=new T.Group();pivot.position.set(x,.4,z);body.add(pivot);if(z>0)frontPivots.push(pivot);
    const wheel=new T.Group();pivot.add(wheel);wheels.push(wheel);
    for(const [geo,mat] of [[tireGeo,trim],[rimGeo,silver]]){const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;wheel.add(mesh);}
    for(let i=0;i<6;i++){const spoke=box(.265,.035,.43,0,0,0,trim,wheel,.006);spoke.rotation.x=i*Math.PI/3;}
  }
  // A small travel case and crossbars give the silhouette an expedition character.
  for(const z of [-1.2,.35])box(1.48,.065,.07,0,1.99,z,silver,cabin);
  box(1.1,.22,1.24,0,2.12,-.47,trim,cabin,.06);
  for(const x of [-.4,.4])box(.035,.225,1.25,x,2.12,-.47,silver,cabin);
  return {root,body,cabin,wheels,frontPivots,steering,tail};
}
