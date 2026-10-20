import * as T from './vendor/three.module.js';
import {roadX,roadY,roadSlope,terrainY,noise,hash,smooth} from './simulation.js';
import {HDRLoader} from './vendor/HDRLoader.js';
import {createGrassGeometry,createMountains,createFlag,createGoat,createContactShadow} from './scenery.js';

export const QUALITY={low:{ahead:6,grass:1800,pixel:1,shadow:512},medium:{ahead:9,grass:5000,pixel:1.5,shadow:1536},high:{ahead:12,grass:9000,pixel:2,shadow:2048}};
const SIZE=240;
const TERRAIN_XS=[-2400,-1900,-1450,-1050,-750,-510,-340,-220,-140,-85,-50,-30,-18,-10,-6,-3,0,3,6,10,18,30,50,85,140,220,340,510,750,1050,1450,1900,2400];
const surfaceRows=new Map();
function surfaceRow(s){if(!surfaceRows.has(s)){surfaceRows.set(s,TERRAIN_XS.map(d=>terrainY(roadX(s)+d,s)));if(surfaceRows.size>256)surfaceRows.delete(surfaceRows.keys().next().value);}return surfaceRows.get(s);}
export function terrainSurfaceY(x,s){
  // Match the rendered triangles, so hooves, tent bases and grass roots sit on the ground.
  const step=SIZE/32,s0=Math.floor(s/step)*step,s1=s0+step,t=(s-s0)/step;
  const d=x-(roadX(s0)*(1-t)+roadX(s1)*t);let i=0;while(i<TERRAIN_XS.length-2&&d>TERRAIN_XS[i+1])i++;
  const a=TERRAIN_XS[i],b=TERRAIN_XS[i+1],u=Math.max(0,Math.min(1,(d-a)/(b-a)));
  const row0=surfaceRow(s0),row1=surfaceRow(s1),y00=row0[i],y10=row0[i+1],y01=row1[i],y11=row1[i+1];
  return t+u<=1?y00*(1-t-u)+y10*u+y01*t:y11*(t+u-1)+y10*(1-t)+y01*(1-u);
}
function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),im=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const h=hash(x,y),q=noise(x/17,y/17),i=(y*256+x)*4;
    const base=kind==='road'?72:kind==='earth'?145:134;
    const n=kind==='road'?h*20-10:(h-.5)*35+(q-.5)*40;
    im.data[i]=base+n;im.data[i+1]=base+n+(kind==='grass'?12:kind==='earth'?-8:1);im.data[i+2]=base+n+(kind==='grass'?-32:kind==='earth'?-29:3);im.data[i+3]=255;
  }ctx.putImageData(im,0,0);
  const tx=new T.CanvasTexture(c);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=4;return tx;
}
function ribbon(s0,length,left,right,step=6,yOffset=.03){
  const count=Math.ceil(length/step),p=[],uv=[],indices=[];
  for(let j=0;j<=count;j++){
    const s=s0+length*j/count,x=roadX(s),y=roadY(s)+yOffset,angle=Math.atan(roadSlope(s));
    for(const d of [left,right]){p.push(x+d*Math.cos(angle),y,s-d*Math.sin(angle));uv.push(d/3,s/3);}
    if(j<count){const a=j*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const dummy=new T.Object3D();
export class SteppeWorld{
  constructor(scene,quality='medium',renderer){
    this.scene=scene;this.quality=quality;this.chunks=new Map();this.origin=0;this.stats={created:0,disposed:0};
    this.grassTex=texture('grass');this.roadTex=texture('road');this.earthTex=texture('earth');this.furTex=texture('earth');
    this.terrainMat=new T.MeshStandardMaterial({map:this.grassTex,vertexColors:true,roughness:.98});
    this.terrainMat.envMapIntensity=.16;
    this.terrainMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grassLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 meadow=vec3(.65,.87,.28)*grassLight*3.4;
      diffuseColor.rgb=mix(diffuseColor.rgb,meadow,.68);`);};
    this.roadMat=new T.MeshStandardMaterial({map:this.roadTex,color:0xa8aaa5,roughness:.94});
    this.earthMat=new T.MeshStandardMaterial({map:this.earthTex,color:0xb2a07d,roughness:1,envMapIntensity:.1});
    this.lineMat=new T.MeshStandardMaterial({color:0xd9d9c6,roughness:1});
    this.poleMat=new T.MeshStandardMaterial({color:0x72694e,roughness:1});
    this.rockMat=new T.MeshStandardMaterial({color:0x9b9d88,roughness:1});
    this.grassMat=new T.MeshLambertMaterial({color:0xc6c78b,side:T.DoubleSide,emissive:0x18220a,emissiveIntensity:.22});
    this.windUniform={value:0};this.grassMat.onBeforeCompile=shader=>{shader.uniforms.steppeTime=this.windUniform;shader.vertexShader='uniform float steppeTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      float phase=instanceMatrix[3].x*.43+instanceMatrix[3].z*.31;
      transformed.x+=sin(steppeTime*1.5+phase)*position.y*position.y*.16;
      transformed.z+=cos(steppeTime*1.1+phase)*position.y*position.y*.10;
      #endif`);};
    this.grassGeo=createGrassGeometry();
    this.rockGeo=new T.DodecahedronGeometry(1,0);
    this.poleGeo=new T.CylinderGeometry(.085,.13,7.8,5);
    this.crossGeo=new T.BoxGeometry(2,.11,.12);
    this.shadowMat=createContactShadow();
    this.flagTexture=new T.TextureLoader().load('./assets/mongolia.svg');this.flagTexture.colorSpace=T.SRGBColorSpace;this.flagTexture.anisotropy=8;
    this.makeSky();this.makeClouds();this.mountains=createMountains();this.scene.add(this.mountains);
    this.loadPhotographicMaterials(renderer);
  }
  loadPhotographicMaterials(renderer){
    const loader=new T.TextureLoader();
    const load=(name,color=true)=>{const tex=loader.load(`./assets/${name}`);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=Math.min(12,renderer?.capabilities.getMaxAnisotropy()||4);if(color)tex.colorSpace=T.SRGBColorSpace;return tex;};
    this.terrainMat.map=load('sparse_grass_diff_1k.jpg');this.terrainMat.normalMap=load('sparse_grass_nor_gl_1k.jpg',false);this.terrainMat.normalScale.set(.5,.5);this.terrainMat.needsUpdate=true;
    this.roadMat.map=load('asphalt_02_diff_1k.jpg');this.roadMat.normalMap=load('asphalt_02_nor_gl_1k.jpg',false);this.roadMat.normalScale.set(.42,.42);this.roadMat.needsUpdate=true;
    loader.load('./assets/sky_4k.jpg',sky=>{sky.colorSpace=T.SRGBColorSpace;sky.mapping=T.EquirectangularReflectionMapping;this.scene.background=sky;this.scene.backgroundIntensity=.9;this.scene.backgroundRotation.y=.75;this.sky.visible=false;this.clouds.visible=false;});
    if(renderer)new HDRLoader().load('./assets/sky_1k.hdr',hdr=>{
      hdr.mapping=T.EquirectangularReflectionMapping;
      const pmrem=new T.PMREMGenerator(renderer);this.environment=pmrem.fromEquirectangular(hdr);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.18;pmrem.dispose();
    },undefined,()=>{console.warn('HDR sky unavailable; using procedural fallback.');});
  }
  makeSky(){
    const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:new T.Vector3(-.45,.68,.54).normalize()}},vertexShader:`varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 dir;uniform vec3 sun;void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 c=mix(vec3(.80,.85,.77),vec3(.31,.59,.71),pow(h,.46));float sd=max(dot(d,sun),0.);c+=vec3(1.,.83,.53)*pow(sd,2200.)*.8;c+=vec3(.27,.22,.13)*pow(sd,12.);gl_FragColor=vec4(c,1.);}`});
    this.sky=new T.Mesh(new T.SphereGeometry(9000,24,14),mat);this.sky.frustumCulled=false;this.sky.renderOrder=-5;this.scene.add(this.sky);
  }
  makeClouds(){
    this.clouds=new T.Group();this.scene.add(this.clouds);
    const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
    for(let i=0;i<28;i++){const x=35+hash(i,3)*185,y=35+hash(i,8)*57,r=20+hash(i,10)*27,g=ctx.createRadialGradient(x,y,r*.1,x,y,r);g.addColorStop(0,'rgba(255,255,246,.32)');g.addColorStop(.5,'rgba(255,255,246,.21)');g.addColorStop(1,'rgba(255,255,246,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;
    const mat=new T.SpriteMaterial({map:tx,transparent:true,opacity:.86,depthWrite:false,fog:true,color:0xf6f6e8});
    for(let i=0;i<30;i++){const cloud=new T.Sprite(mat);cloud.position.set((hash(i,42)-.5)*8500,650+hash(i,51)*950,(hash(i,62)-.5)*8500);cloud.scale.set(900+hash(i,7)*1100,290+hash(i,3)*230,1);this.clouds.add(cloud);}
  }
  setQuality(q){if(q===this.quality)return;this.quality=q;for(const [i,c] of this.chunks)this.disposeChunk(i,c);this.chunks.clear();}
  terrain(s0){
    const xs=TERRAIN_XS,nz=32,p=[],colors=[],uv=[],ix=[];
    const c=new T.Color();
    for(let j=0;j<=nz;j++){const s=s0+j*SIZE/nz;for(let i=0;i<xs.length;i++){
      const x=roadX(s)+xs[i],y=terrainY(x,s),d=Math.abs(xs[i]);p.push(x,y,s-s0);uv.push(x/3.5,s/3.5);
      const n=noise(x/180,s/180),dry=noise(x/350+61,s/350+44);
      c.setRGB(.83+n*.33,.87+n*.27,.73+dry*.3);
      if(d<6.5)c.lerp(new T.Color(0xa4a07c),1-smooth(5.2,7,d));
      c.lerp(new T.Color(0xafb0a0),smooth(500,2300,d)*.48);colors.push(c.r,c.g,c.b);
      if(j<nz&&i<xs.length-1){const a=j*xs.length+i;ix.push(a,a+xs.length,a+1,a+1,a+xs.length,a+xs.length+1);}
    }}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();return new T.Mesh(geo,this.terrainMat);
  }
  makeGer(x,s,scale=1){
    const ger=new T.Group(),white=new T.MeshStandardMaterial({color:0xe6ddc3,roughness:1}),trim=new T.MeshStandardMaterial({color:0x665442,roughness:1}),red=new T.MeshStandardMaterial({color:0x7e3c2b,roughness:.95});
    const body=new T.Mesh(new T.CylinderGeometry(3.2,3.3,2.15,24),white);body.position.y=1.1;body.castShadow=true;ger.add(body);
    const roof=new T.Mesh(new T.ConeGeometry(3.35,1.8,24),white);roof.position.y=3.05;roof.castShadow=true;ger.add(roof);
    for(const y of [.32,1.65,2.12]){const band=new T.Mesh(new T.CylinderGeometry(3.32,3.32,.07,24,1,true),trim);band.position.y=y;ger.add(band);}
    const door=new T.Mesh(new T.BoxGeometry(.92,1.65,.12),red);door.position.set(0,.85,-3.25);ger.add(door);
    const chimney=new T.Mesh(new T.CylinderGeometry(.12,.12,1.3,6),trim);chimney.position.set(.7,4,0);ger.add(chimney);
    ger.position.set(x,terrainSurfaceY(x,s),s);ger.scale.setScalar(scale);return ger;
  }
  makeSheep(x,s,seed){
    const group=new T.Group(),wool=new T.MeshStandardMaterial({color:0xd3cead,roughness:1}),dark=new T.MeshStandardMaterial({color:0x514d3b,roughness:1});
    const body=new T.Mesh(new T.IcosahedronGeometry(.65,1),wool);body.scale.set(1.25,.8,.75);body.position.y=.85;body.castShadow=true;group.add(body);
    const head=new T.Mesh(new T.IcosahedronGeometry(.24,0),dark);head.position.set(.72,.85,0);group.add(head);
    for(const a of [-.4,.4])for(const b of [-.25,.25]){const leg=new T.Mesh(new T.CylinderGeometry(.055,.04,.6,4),dark);leg.position.set(a,.3,b);group.add(leg);}
    group.position.set(x,terrainSurfaceY(x,s),s);group.rotation.y=hash(seed,9)*6.28;return group;
  }
  batchScenery(group){
    // Bake static props by material. Sheep and ger parts should not each cost a draw call.
    group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),oldMaterials=new Set();
    const props=group.children.filter(o=>o.isGroup&&!o.userData.dynamic);
    for(const prop of props){prop.traverse(mesh=>{
      if(!mesh.isMesh)return;const material=mesh.material,key=`${material.color.getHex()}-${material.roughness}`;
      if(!batches.has(key))batches.set(key,{positions:[],normals:[],uvs:[],material});
      const batch=batches.get(key),g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
      batch.positions.push(...g.attributes.position.array);batch.normals.push(...g.attributes.normal.array);
      if(g.attributes.uv)batch.uvs.push(...g.attributes.uv.array);else for(let j=0;j<g.attributes.position.count;j++)batch.uvs.push(0,0);
      g.dispose();mesh.geometry.dispose();oldMaterials.add(material);
    });group.remove(prop);}
    const retained=new Set();
    for(const batch of batches.values()){
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(batch.normals,3));
      geo.setAttribute('uv',new T.Float32BufferAttribute(batch.uvs,2));
      const mesh=new T.Mesh(geo,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);retained.add(batch.material);
    }
    for(const material of oldMaterials)if(!retained.has(material))material.dispose();
  }
  buildChunk(index){
    const s0=index*SIZE,group=new T.Group();group.position.z=s0-this.origin;group.userData.s0=s0;
    const ground=this.terrain(s0);ground.receiveShadow=true;group.add(ground);
    for(const [l,r,mat,y] of [[-5.7,-3.5,this.earthMat,-.03],[3.5,5.7,this.earthMat,-.03],[-3.5,3.5,this.roadMat,.02],[-3.33,-3.24,this.lineMat,.035],[3.24,3.33,this.lineMat,.035]]){
      const geo=ribbon(s0,SIZE,l,r,4,y);geo.translate(0,0,-s0);const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;group.add(mesh);
    }
    for(let s=s0;s<s0+SIZE;s+=12){const geo=ribbon(s,5,-.055,.055,2,.041);geo.translate(0,0,-s0);group.add(new T.Mesh(geo,this.lineMat));}
    const cfg=QUALITY[this.quality],grass=new T.InstancedMesh(this.grassGeo,this.grassMat,cfg.grass),col=new T.Color();
    for(let i=0;i<cfg.grass;i++){
      const s=s0+hash(i,index+19)*SIZE,side=hash(i,index+3)>.5?1:-1,d=6.2+Math.pow(hash(i,index+7),2)*65,x=roadX(s)+side*d;
      dummy.position.set(x,terrainSurfaceY(x,s),s-s0);dummy.rotation.set(0,hash(i,index+8)*6.28,0);const size=.5+hash(i,index+34)*.9;dummy.scale.setScalar(size);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
      col.setHSL(.15+hash(i,11)*.09,.23+hash(i,5)*.12,.25+hash(i,13)*.17);grass.setColorAt(i,col);
    }grass.computeBoundingSphere();group.add(grass);
    const rocks=new T.InstancedMesh(this.rockGeo,this.rockMat,48);
    for(let i=0;i<48;i++){const s=s0+hash(i+400,index)*SIZE,d=(hash(i,53)>.5?1:-1)*(6+hash(i,index+73)*130),x=roadX(s)+d;dummy.position.set(x,terrainY(x,s)+.05,s-s0);dummy.rotation.set(hash(i,5),hash(i,6),hash(i,7));const a=.05+hash(i,index+88)*.48;dummy.scale.set(a*1.8,a*.7,a);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.computeBoundingSphere();group.add(rocks);
    const wires=[];
    for(let s=s0;s<s0+SIZE;s+=60){const x=roadX(s)+15,y=terrainY(x,s);const pole=new T.Mesh(this.poleGeo,this.poleMat);pole.position.set(x,y+3.9,s-s0);group.add(pole);const cross=new T.Mesh(this.crossGeo,this.poleMat);cross.position.set(x,y+7.3,s-s0);group.add(cross);
      const next=s+60,nx=roadX(next)+15,ny=terrainY(nx,next);
      for(const dx of [-.75,.75])for(let j=0;j<8;j++){for(const t of [j/8,(j+1)/8])wires.push(x+(nx-x)*t+dx,y+7.4+(ny-y)*t-Math.sin(t*Math.PI)*.65,s-s0+60*t);}
    }
    const wiregeo=new T.BufferGeometry();wiregeo.setAttribute('position',new T.Float32BufferAttribute(wires,3));group.add(new T.LineSegments(wiregeo,new T.LineBasicMaterial({color:0x686e59,transparent:true,opacity:.65})));
    if(index%3===0){
      const s=s0+135,x=roadX(s)-65-hash(index,33)*35;
      const ger=this.makeGer(x,s);ger.position.z-=s0;group.add(ger);
      const second=this.makeGer(x-13,s+10,.72);second.position.z-=s0;group.add(second);
      for(let i=0;i<9;i++){const a=s+hash(i,index+90)*42-21,b=x+15+hash(i,index+23)*28;const sheep=this.makeSheep(b,a,index*10+i);sheep.position.z-=s0;group.add(sheep);}
    }
    group.userData.flags=[];group.userData.goats=[];
    if(index%3===0){
      const s=s0+112,x=roadX(s)-8.2;
      const flag=createFlag(this.flagTexture);flag.position.set(x,terrainSurfaceY(x,s),s-s0);group.add(flag);group.userData.flags.push(flag.userData.flag);
      const herdCount=this.quality==='low'?5:8;
      for(let i=0;i<herdCount;i++){
        const z=s0+98+hash(i,index+48)*55,gx=roadX(z)-11-hash(i,index+77)*14;
        const goat=createGoat(Math.abs(index*11+i),this.batchScenery.bind(this),this.furTex,this.shadowMat);goat.position.set(gx,terrainSurfaceY(gx,z),z-s0);group.add(goat);group.userData.goats.push(goat);
      }
    }
    this.batchScenery(group);this.chunks.set(index,group);this.scene.add(group);this.stats.created++;
  }
  disposeChunk(index,group){
    const shared=new Set([this.grassGeo,this.rockGeo,this.poleGeo,this.crossGeo]);
    group.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))o.geometry.dispose();if(o.isInstancedMesh)o.dispose();if(o.material&&!['terrainMat','roadMat','earthMat','lineMat','poleMat','rockMat','grassMat','shadowMat'].some(k=>this[k]===o.material))o.material.dispose();});
    this.scene.remove(group);this.chunks.delete(index);this.stats.disposed++;
  }
  update(s,camera,time=0){
    // Rebase every 2 km to keep GPU vertex precision stable on endless rides.
    const origin=Math.floor(s/2000)*2000;
    if(origin!==this.origin){this.origin=origin;for(const c of this.chunks.values())c.position.z=c.userData.s0-origin;}
    const current=Math.floor(s/SIZE),cfg=QUALITY[this.quality];
    for(const [i,c] of this.chunks)if(i<current-2||i>current+cfg.ahead)this.disposeChunk(i,c);
    // At most one chunk per frame after initial preparation.
    for(let i=current-2;i<=current+cfg.ahead;i++)if(!this.chunks.has(i)){this.buildChunk(i);break;}
    this.sky.position.copy(camera.position);this.clouds.position.set(roadX(s)*.35,0,s-this.origin);
    this.mountains.position.set(roadX(s),roadY(s)-20,s-this.origin);this.windUniform.value=time;
    for(const chunk of this.chunks.values()){
      for(const flag of chunk.userData.flags||[]){
        const attr=flag.geometry.attributes.position,rest=flag.userData.rest;
        for(let i=0;i<attr.count;i++){const x=rest[i*3],y=rest[i*3+1];attr.setZ(i,Math.sin(x*2.7-time*3.3+y*.8)*.20*(x/4.6)+Math.sin(x*5-time*4.4)*.07*(x/4.6));attr.setY(i,y-Math.pow(x/4.6,2)*.16);}
        attr.needsUpdate=true;flag.geometry.computeVertexNormals();
      }
      for(const goat of chunk.userData.goats||[]){const phase=goat.userData.phase;goat.userData.head.rotation.z=-.5+Math.sin(time*.47+phase)*.39;goat.userData.head.rotation.y=Math.sin(time*.37+phase)*.12;}
    }
  }
  warmup(s){const c=Math.floor(s/SIZE);for(let i=c-2;i<=c+QUALITY[this.quality].ahead;i++)this.buildChunk(i);}
}
