import * as T from './vendor/three.module.js';
import {RideSimulation,clamp,roadX,roadY,roadSlope,terrainY} from './simulation.js';
import {SteppeWorld,QUALITY} from './world.js';
import {createBike} from './bike.js';
import {RideAudio} from './audio.js';

const $=id=>document.getElementById(id),sim=new RideSimulation(),audio=new RideAudio();
const keys=new Set(),touch={left:0,right:0,throttle:0,brake:0};
let renderer,scene,camera,world,bike,sun,started=false,paused=false,view=0,last=performance.now(),accumulator=0,uiTimer=0,fpsFrames=0,fpsElapsed=0,fps=60,previousRecoveries=0,toastTimer;
let previousOrigin=0,shake=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const cameraPosition=new T.Vector3(),cameraTarget=new T.Vector3(),lookAt=new T.Vector3(),bikePosition=new T.Vector3();
const viewNames=['3인칭 · 따라가기','1인칭 · 헬멧','핸들바 시점','넓게 보기'];
const config={quality:matchMedia('(pointer:coarse)').matches?'low':'medium'};
let steeringPointer=null,dragStart=0,dragSteer=0;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function error(message){$('errorText').textContent=message;$('error').classList.remove('hidden');}
function clearInput(){keys.clear();for(const k of Object.keys(touch))touch[k]=0;dragSteer=0;steeringPointer=null;document.querySelectorAll('.held').forEach(el=>el.classList.remove('held'));}
function updateSoundButton(){$('soundToggle').textContent=audio.enabled?'♪':'♩';$('soundToggle').setAttribute('aria-label',audio.enabled?'소리 끄기':'소리 켜기');$('soundToggle').title=audio.enabled?'소리 끄기':'소리 켜기';$('soundToggle').style.opacity=audio.enabled?'1':'.5';}
function updateCruise(){
  document.querySelectorAll('[data-cruise]').forEach(b=>{const on=Number(b.dataset.cruise)===sim.cruise;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('cruiseStatus').textContent=sim.cruise?`크루즈 · ${sim.cruise} km/h 유지`:'나만의 속도로';
}
function setPause(value,dialog=true){if(!started)return;paused=value;clearInput();accumulator=0;
  if(value&&dialog&&!$('pauseDialog').open)$('pauseDialog').showModal();
  if(!value&&$('pauseDialog').open)$('pauseDialog').close();
  $('pauseButton').setAttribute('aria-label',paused?'주행 재개':'일시정지');
}
function setMode(mode){sim.mode=mode;$('startMode').value=mode;$('rideMode').value=mode;$('modeLabel').textContent=mode==='tour'?'관광 모드':'스피드 모드';saveSettings();}
function saveSettings(){try{localStorage.setItem('steppe-settings-v1',JSON.stringify({quality:config.quality,mode:sim.mode,assist:sim.assist,shake,hud:$('hudToggle').checked,engine:audio.engineVolume,wind:audio.windVolume,sound:audio.enabled}));}catch{}}
function loadSettings(){try{const data=JSON.parse(localStorage.getItem('steppe-settings-v1')||'null');if(!data)return;
  if(QUALITY[data.quality])config.quality=data.quality;if(['tour','speed'].includes(data.mode))sim.mode=data.mode;
  if(typeof data.assist==='boolean')sim.assist=data.assist;if(typeof data.shake==='boolean')shake=data.shake;
  if(typeof data.hud==='boolean')$('hudToggle').checked=data.hud;
  if(Number.isFinite(data.engine))audio.engineVolume=clamp(data.engine,0,1);if(Number.isFinite(data.wind))audio.windVolume=clamp(data.wind,0,1);if(typeof data.sound==='boolean')audio.enabled=data.sound;
}catch{}}
function quality(q){config.quality=q;const cfg=QUALITY[q];renderer.setPixelRatio(Math.min(devicePixelRatio||1,cfg.pixel));renderer.shadowMap.enabled=!!cfg.shadow;
  if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.setScalar(cfg.shadow||512);world.setQuality(q);resize();saveSettings();}
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function init(){
  loadSettings();
  renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,QUALITY[config.quality].pixel));renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=!!QUALITY[config.quality].shadow;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene();scene.background=new T.Color(0xc6d4bf);scene.fog=new T.FogExp2(0xc4d0b9,.00048);
  camera=new T.PerspectiveCamera(58,innerWidth/innerHeight,.12,10000);
  scene.add(new T.HemisphereLight(0xe2eef0,0x7a804c,2.1));
  sun=new T.DirectionalLight(0xffe7bb,2.5);sun.castShadow=true;sun.shadow.mapSize.setScalar(QUALITY[config.quality].shadow||512);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.camera.near=1;sun.shadow.camera.far=650;sun.shadow.bias=-.0003;sun.shadow.normalBias=.06;scene.add(sun,sun.target);
  world=new SteppeWorld(scene,config.quality);world.warmup(sim.s);
  bike=createBike();scene.add(bike.root);
  $('quality').value=config.quality;$('shakeToggle').checked=shake;$('assistToggle').checked=sim.assist;$('engineVolume').value=audio.engineVolume*100;$('windVolume').value=audio.windVolume*100;
  setMode(sim.mode);document.body.classList.toggle('hud-off',!$('hudToggle').checked);updateSoundButton();updateCruise();
  positionScene(1,true);renderer.render(scene,camera);last=performance.now();requestAnimationFrame(frame);
  // Read-only diagnostics help repeatable QA without affecting gameplay.
  window.steppe={getState:()=>({started,paused,speed:sim.v*3.6,distance:sim.distance,gear:sim.gear,rpm:sim.rpm,s:sim.s,offset:sim.offset,cruise:sim.cruise,mode:sim.mode,view,quality:config.quality,chunks:world.chunks.size,created:world.stats.created,disposed:world.stats.disposed,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,fps,recoveries:sim.recoveries,surface:sim.surface}),version:'1.0.0'};
}
function readInput(){
  let steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0)+touch.left-touch.right+dragSteer;
  let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)||touch.throttle,brake=(keys.has('KeyS')||keys.has('ArrowDown')||keys.has('Space')?1:0)||touch.brake;
  try{const gp=Array.from(navigator.getGamepads?.()||[]).find(g=>g?.connected);if(gp){const axis=gp.axes[0]||0;if(Math.abs(axis)>.12)steer-=axis;throttle=Math.max(throttle,gp.buttons[7]?.value||0,gp.buttons[0]?.value||0);brake=Math.max(brake,gp.buttons[6]?.value||0,gp.buttons[1]?.value||0);}}catch{}
  return {steer:clamp(steer,-1,1),throttle,brake};
}
function positionScene(dt,instant=false){
  const origin=Math.floor(sim.s/2000)*2000;
  if(origin!==previousOrigin){camera.position.z-=origin-previousOrigin;lookAt.z-=origin-previousOrigin;previousOrigin=origin;}
  const tangent=Math.atan(roadSlope(sim.s)),heading=tangent+sim.heading;
  const bx=roadX(sim.s)+sim.offset*Math.cos(tangent),bz=sim.s-sim.offset*Math.sin(tangent);
  const by=sim.surface==='asphalt'?roadY(sim.s):terrainY(bx,sim.s);
  bikePosition.set(bx,by,bz-origin);bike.root.position.copy(bikePosition);bike.root.rotation.y=heading;
  bike.body.rotation.z=sim.lean;bike.body.rotation.x=-(roadY(sim.s+1)-roadY(sim.s-1))/2;
  const bump=started&&shake&&!paused?Math.sin(sim.distance*(sim.surface==='grass'?6:2.7))*(sim.surface==='grass'?.024:.003)*Math.min(sim.v/15,1):0;
  bike.body.position.y=bump;bike.handle.rotation.y=-sim.heading*.35;bike.rider.rotation.z=-sim.lean*.12;
  for(const wheel of bike.wheels)wheel.rotation.x=sim.distance/.36;
  bike.rider.visible=view===0||view===3||!started;
  const sx=Math.sin(heading),cz=Math.cos(heading);
  if(!started){cameraPosition.set(bx+9,by+4.7,bz-origin-13);cameraTarget.set(bx+3,by+1.7,bz-origin+22);}
  else if(view===0){cameraPosition.set(bx-sx*8.2,by+3.35+bump,bz-origin-cz*8.2);cameraTarget.set(bx+sx*13,by+1.15,bz-origin+cz*13);}
  else if(view===1){cameraPosition.set(bx+sx*.05,by+1.96+bump,bz-origin+cz*.05);cameraTarget.set(bx+sx*40,by+1.6,bz-origin+cz*40);}
  else if(view===2){cameraPosition.set(bx+sx*.22,by+1.49+bump,bz-origin+cz*.22);cameraTarget.set(bx+sx*35,by+1.3,bz-origin+cz*35);}
  else{cameraPosition.set(bx-sx*15+Math.cos(heading)*7,by+7,bz-origin-cz*15-Math.sin(heading)*7);cameraTarget.set(bx+sx*17,by+1.2,bz-origin+cz*17);}
  if(started&&shake&&!paused){const amount=sim.v/50*.01;cameraPosition.x+=Math.sin(sim.distance*1.7)*amount;cameraPosition.y+=Math.sin(sim.distance*3)*amount;}
  const blend=instant?1:1-Math.exp(-dt*(view===0||view===3?5:16));camera.position.lerp(cameraPosition,blend);lookAt.lerp(cameraTarget,blend);camera.lookAt(lookAt);
  const fov=58+(started?clamp(sim.v/50,0,1)*5:0);if(Math.abs(camera.fov-fov)>.05){camera.fov=fov;camera.updateProjectionMatrix();}
  world.update(sim.s,camera);
  sun.position.set(bx-170,by+270,bz-origin+180);sun.target.position.set(bx,by,bz-origin+15);
}
function updateUI(){
  $('speed').textContent=Math.round(sim.v*3.6);$('gear').textContent=sim.gear||'N';$('rpm').textContent=Math.round(sim.rpm/100)*100;$('rpmFill').style.width=`${clamp(sim.rpm/10000*100,0,100)}%`;
  $('distance').textContent=(sim.distance/1000).toFixed(2);$('lean').textContent=Math.round(Math.abs(sim.lean)*180/Math.PI);$('surface').textContent=sim.surface==='grass'?'초지 · 낮은 접지력':'아스팔트';
  $('fps').textContent=$('fpsToggle').checked?`${Math.round(fps)} FPS`:'';
  $('fps').dataset.chunks=world.chunks.size;$('fps').dataset.created=world.stats.created;$('fps').dataset.disposed=world.stats.disposed;$('fps').dataset.geometries=renderer.info.memory.geometries;$('fps').dataset.drawCalls=renderer.info.render.calls;
  if(sim.recovery>0)$('surface').textContent='자세를 회복하고 있어요';
  updateCruise();
}
function frame(now){
  const elapsed=Math.min((now-last)/1000,.1);last=now;fpsFrames++;fpsElapsed+=elapsed;
  if(fpsElapsed>=1){fps=fpsFrames/fpsElapsed;fpsFrames=0;fpsElapsed=0;}
  if(started&&!paused){accumulator+=elapsed;const input=readInput();while(accumulator>=1/60){sim.update(1/60,input);accumulator-=1/60;}
    if(sim.recoveries!==previousRecoveries){previousRecoveries=sim.recoveries;toast('괜찮아요. 도로로 돌아왔습니다.');}
  }else accumulator=0;
  positionScene(elapsed);audio.update(sim,started&&!paused);uiTimer+=elapsed;
  if(uiTimer>.1){updateUI();uiTimer=0;}
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
async function start(){if(started)return;started=true;setMode($('startMode').value);$('welcome').classList.add('hidden');$('chapter').classList.add('hidden');$('rideUI').classList.remove('hidden');$('viewLabel').classList.remove('hidden');document.body.classList.add('started');
  try{await audio.init();}catch{toast('소리를 시작할 수 없어요. 소리 버튼으로 다시 시도해 주세요.');}
  toast('당신의 속도로 달려보세요. 크루즈를 켜면 더 여유로워요.');
}
function changeView(){if(!started){toast('출발 후 카메라를 전환할 수 있어요.');return;}view=(view+1)%4;$('viewLabel').textContent=viewNames[view];toast(viewNames[view]);}
$('startButton').addEventListener('click',start);
$('cameraButton').addEventListener('click',changeView);
$('pauseButton').addEventListener('click',()=>setPause(!paused));
$('resumeButton').addEventListener('click',()=>setPause(false));
$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();setPause(false);});
$('soundToggle').addEventListener('click',async()=>{if(!audio.ctx){try{await audio.init();audio.enabled=true;}catch{toast('이 브라우저에서 소리를 시작하지 못했어요.');return;}}else audio.enabled=!audio.enabled;updateSoundButton();saveSettings();});
$('settingsButton').addEventListener('click',()=>{if(started)setPause(true,false);clearInput();$('settingsDialog').showModal();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('settingsDialog').addEventListener('close',()=>{if(started)setPause(false);});
$('quality').addEventListener('change',e=>{quality(e.target.value);toast('그래픽 품질을 변경했습니다.');});
$('rideMode').addEventListener('change',e=>setMode(e.target.value));
$('hudToggle').addEventListener('change',e=>{document.body.classList.toggle('hud-off',!e.target.checked);saveSettings();});
$('shakeToggle').addEventListener('change',e=>{shake=e.target.checked;saveSettings();});
$('assistToggle').addEventListener('change',e=>{sim.assist=e.target.checked;saveSettings();});
$('engineVolume').addEventListener('input',e=>{audio.engineVolume=e.target.value/100;saveSettings();});
$('windVolume').addEventListener('input',e=>{audio.windVolume=e.target.value/100;saveSettings();});
$('resetButton').addEventListener('click',()=>{sim.recover();toast('오른쪽 차로로 돌아왔습니다.');$('settingsDialog').close();});
$('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('이 브라우저에서는 전체 화면 버튼을 지원하지 않아요.');}catch{toast('브라우저에서 전체 화면을 허용하지 않았어요.');}});
document.querySelectorAll('[data-cruise]').forEach(b=>b.addEventListener('click',()=>{if(!started)return;sim.cruise=Number(b.dataset.cruise);updateCruise();toast(`${sim.cruise} km/h로 천천히 맞춥니다. 제동하면 해제됩니다.`);}));
$('cruiseOff').addEventListener('click',()=>{sim.cruise=0;updateCruise();});
window.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||$('settingsDialog').open)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat)return;if(e.code==='KeyC')changeView();else if(e.code==='KeyP'&&!$('settingsDialog').open)setPause(!paused);else if(e.code==='Escape'&&started&&!$('settingsDialog').open&&!$('pauseDialog').open)setPause(true);else if(!paused)keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();if(started&&!paused)setPause(true,false);});
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&started){setPause(true,false);audio.update(sim,false);}});
window.addEventListener('focus',()=>{if(started&&paused&&!$('settingsDialog').open&&!$('pauseDialog').open)$('pauseDialog').showModal();});
document.querySelectorAll('[data-input]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;button.setPointerCapture(e.pointerId);touch[button.dataset.input]=1;button.classList.add('held');});
  const release=()=>{touch[button.dataset.input]=0;button.classList.remove('held');};for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
});
// Mouse / pen dragging on the landscape steers. Touch uses independent multi-touch buttons.
$('scene').addEventListener('pointerdown',e=>{if(!started||paused||e.pointerType==='touch')return;steeringPointer=e.pointerId;dragStart=e.clientX;$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(e.pointerId===steeringPointer)dragSteer=clamp((dragStart-e.clientX)/160,-1,1);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(event,()=>{steeringPointer=null;dragSteer=0;});
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true,false);error('3D 그래픽 연결이 중단됐습니다. 다른 탭을 닫거나 품질을 낮춘 뒤 다시 시작해 주세요.');});
window.addEventListener('resize',resize);
try{init();}catch(err){console.error(err);error('WebGL2 화면을 시작하지 못했습니다. 최신 브라우저에서 하드웨어 가속을 켜고 다시 시도해 주세요.');}
