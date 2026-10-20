import * as T from './vendor/three.module.js';
import { RideSimulation, clamp, roadX, roadY, roadSlope, terrainY } from './simulation.js?v=1.3';
import { SteppeWorld, QUALITY } from './world.js?v=1.3';
import { createBike } from './bike.js?v=1.3';
import { createCar } from './car.js?v=1.3';
import { RideAudio } from './audio.js?v=1.3';

const $ = id => document.getElementById(id), sim = new RideSimulation(), audio = new RideAudio();
const keys = new Set(), touch = { left: 0, right: 0, throttle: 0, brake: 0 };
let renderer, scene, camera, world, bike, sun, started = false, paused = false, view = 0, last = performance.now(), accumulator = 0, uiTimer = 0, fpsFrames = 0, fpsElapsed = 0, fps = 60, previousRecoveries = 0, toastTimer;
let previousOrigin = 0, shake = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let sceneryTime = 0, car, previousBiome = 'steppe';
const cameraPosition = new T.Vector3(), cameraTarget = new T.Vector3(), lookAt = new T.Vector3(), bikePosition = new T.Vector3();
const viewNames = () => sim.vehicle === 'car' ? ['뒤에서', '운전석', '보닛', '넓게'] : ['뒤에서', '헬멧', '핸들바', '넓게'];
const BIOME_NAMES = { steppe: '몽골의 초원', gobi: '고비 모래·자갈 지대', lake: '초원 호숫가' };
const isCoarse = matchMedia('(pointer:coarse)').matches;
const isTablet = isCoarse && Math.min(window.innerWidth, window.innerHeight) >= 600;
const config = { quality: isCoarse ? (isTablet ? 'medium' : 'low') : 'ultra' };
let steeringPointer = null, dragStart = 0, dragSteer = 0, tiltEnabled = false, tiltSteer = 0, wakeLock = null, deferredInstallPrompt = null;

function haptic(ms = 12) {
  if (shake && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(ms); } catch {}
  }
}
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden || !started || paused) return;
  try {
    if (!wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}
function releaseWakeLock() {
  if (wakeLock) {
    try { wakeLock.release(); } catch {}
    wakeLock = null;
  }
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
}
function error(message) {
  $('errorText').textContent = message;
  $('error').classList.remove('hidden');
}
function clearInput() {
  keys.clear();
  for (const k of Object.keys(touch)) touch[k] = 0;
  dragSteer = 0;
  steeringPointer = null;
  document.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
}
function updateSoundButton() {
  $('soundToggle').textContent = audio.enabled ? '♪' : '♩';
  $('soundToggle').setAttribute('aria-label', audio.enabled ? '소리 끄기' : '소리 켜기');
  $('soundToggle').title = audio.enabled ? '소리 끄기' : '소리 켜기';
  $('soundToggle').style.opacity = audio.enabled ? '1' : '.5';
}
function updateCruise() {
  document.querySelectorAll('[data-cruise]').forEach(b => {
    const on = Number(b.dataset.cruise) === sim.cruise;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('cruiseStatus').textContent = sim.cruise ? `크루즈 · ${sim.cruise} km/h 유지` : '나만의 속도로';
}
function setPause(value, dialog = true) {
  if (!started) return;
  paused = value;
  clearInput();
  accumulator = 0;
  if (value) releaseWakeLock();
  else requestWakeLock();
  if (value && dialog && !$('pauseDialog').open) $('pauseDialog').showModal();
  if (!value && $('pauseDialog').open) $('pauseDialog').close();
  $('pauseButton').setAttribute('aria-label', paused ? '주행 재개' : '일시정지');
}
function setMode(mode) {
  sim.mode = mode;
  $('startMode').value = mode;
  $('rideMode').value = mode;
  $('modeLabel').textContent = mode === 'tour' ? '관광 모드' : '스피드 모드';
  saveSettings();
}
function saveSettings() {
  try {
    localStorage.setItem('steppe-settings-v1', JSON.stringify({
      quality: config.quality,
      qualityUserSet: true,
      mode: sim.mode,
      vehicle: sim.vehicle,
      view,
      assist: sim.assist,
      shake,
      tilt: tiltEnabled,
      hud: $('hudToggle').checked,
      engine: audio.engineVolume,
      wind: audio.windVolume,
      sound: audio.enabled,
    }));
  } catch {}
}
function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem('steppe-settings-v1') || 'null');
    if (!data) return;
    if (QUALITY[data.quality] && data.qualityUserSet) config.quality = data.quality;
    if (['tour', 'speed'].includes(data.mode)) sim.mode = data.mode;
    if (['bike', 'car'].includes(data.vehicle)) sim.setVehicle(data.vehicle);
    if (Number.isInteger(data.view) && data.view >= 0 && data.view < 4) view = data.view;
    if (typeof data.assist === 'boolean') sim.assist = data.assist;
    if (typeof data.shake === 'boolean') shake = data.shake;
    if (typeof data.tilt === 'boolean') tiltEnabled = data.tilt;
    if (typeof data.hud === 'boolean') $('hudToggle').checked = data.hud;
    if (Number.isFinite(data.engine)) audio.engineVolume = clamp(data.engine, 0, 1);
    if (Number.isFinite(data.wind)) audio.windVolume = clamp(data.wind, 0, 1);
    if (typeof data.sound === 'boolean') audio.enabled = data.sound;
  } catch {}
}
function quality(q) {
  if (!QUALITY[q]) return;
  config.quality = q;
  const cfg = QUALITY[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.pixel));
  renderer.shadowMap.enabled = !!cfg.shadow;
  renderer.toneMappingExposure = q === 'ultra' ? 1.09 : 1.06;
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  sun.shadow.mapSize.setScalar(cfg.shadow || 512);
  world.setQuality(q);
  resize();
  saveSettings();
}
function resize() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function init() {
  loadSettings();
  renderer = new T.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY[config.quality].pixel));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = config.quality === 'ultra' ? 1.09 : 1.06;
  renderer.shadowMap.enabled = !!QUALITY[config.quality].shadow;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  scene = new T.Scene();
  scene.background = new T.Color(0xcbdce5);
  scene.fog = new T.FogExp2(0xc1d3de, 0.00016);
  camera = new T.PerspectiveCamera(58, innerWidth / innerHeight, 0.12, 10000);
  scene.add(new T.HemisphereLight(0xcbdfe8, 0x6b694c, 1.08));

  sun = new T.DirectionalLight(0xffedce, 2.75);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(QUALITY[config.quality].shadow || 512);
  sun.shadow.camera.left = -46;
  sun.shadow.camera.right = 46;
  sun.shadow.camera.top = 46;
  sun.shadow.camera.bottom = -46;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 650;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  world = new SteppeWorld(scene, config.quality, renderer);
  world.warmup(sim.s);
  bike = createBike();
  scene.add(bike.root);
  car = createCar();
  scene.add(car.root);
  syncVehicleUI();

  $('quality').value = config.quality;
  $('shakeToggle').checked = shake;
  if ($('tiltToggle')) $('tiltToggle').checked = tiltEnabled;
  $('assistToggle').checked = sim.assist;
  $('engineVolume').value = audio.engineVolume * 100;
  $('windVolume').value = audio.windVolume * 100;
  setMode(sim.mode);
  document.body.classList.toggle('hud-off', !$('hudToggle').checked);
  updateSoundButton();
  updateCruise();
  positionScene(1, true);
  renderer.render(scene, camera);
  last = performance.now();
  requestAnimationFrame(frame);

  // Read-only diagnostics help repeatable QA without affecting gameplay.
  window.steppe = {
    getState: () => ({
      started,
      paused,
      speed: sim.v * 3.6,
      distance: sim.distance,
      gear: sim.gear,
      rpm: sim.rpm,
      s: sim.s,
      offset: sim.offset,
      cruise: sim.cruise,
      mode: sim.mode,
      vehicle: sim.vehicle,
      view,
      quality: config.quality,
      tilt: tiltEnabled,
      chunks: world.chunks.size,
      created: world.stats.created,
      disposed: world.stats.disposed,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      fps,
      recoveries: sim.recoveries,
      surface: sim.surface,
      roadSurface: sim.roadSurface,
      biome: sim.biome,
    }),
    jumpTo: s => {
      sim.s = Number(s) || 80;
      sim.distance = Math.max(0, sim.s - 80);
      positionScene(1, true);
      updateUI();
      renderer.render(scene, camera);
    },
    version: '1.4.0',
  };
}
function readInput() {
  let steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) + touch.left - touch.right + dragSteer + (tiltEnabled ? tiltSteer : 0);
  let throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) || touch.throttle;
  let brake = (keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Space') ? 1 : 0) || touch.brake;
  try {
    const gp = Array.from(navigator.getGamepads?.() || []).find(g => g?.connected);
    if (gp) {
      const axis = gp.axes[0] || 0;
      if (Math.abs(axis) > 0.12) steer -= axis;
      throttle = Math.max(throttle, gp.buttons[7]?.value || 0, gp.buttons[0]?.value || 0);
      brake = Math.max(brake, gp.buttons[6]?.value || 0, gp.buttons[1]?.value || 0);
    }
  } catch {}
  return { steer: clamp(steer, -1, 1), throttle, brake };
}
function positionScene(dt, instant = false) {
  const origin = Math.floor(sim.s / 2000) * 2000;
  if (origin !== previousOrigin) {
    camera.position.z -= origin - previousOrigin;
    lookAt.z -= origin - previousOrigin;
    previousOrigin = origin;
  }
  const tangent = Math.atan(roadSlope(sim.s)), heading = tangent + sim.heading;
  const bx = roadX(sim.s) + sim.offset * Math.cos(tangent), bz = sim.s - sim.offset * Math.sin(tangent);
  const by = sim.surface !== 'grass' ? roadY(sim.s) : terrainY(bx, sim.s);
  const isCar = sim.vehicle === 'car', vehicle = isCar ? car : bike;

  bikePosition.set(bx, by, bz - origin);
  vehicle.root.position.copy(bikePosition);
  vehicle.root.rotation.y = heading;
  vehicle.body.rotation.z = sim.lean;
  vehicle.body.rotation.x = -(roadY(sim.s + 1) - roadY(sim.s - 1)) / 2 + (sim.pitch || 0);

  const surfInfo = sim.surfaceInfo;
  const bump = started && shake && !paused ? Math.sin(sim.distance * surfInfo.freq) * surfInfo.rough * Math.min(sim.v / 15, 1) : 0;
  vehicle.body.position.y = bump * (isCar ? 0.5 : 1);
  for (const wheel of vehicle.wheels) wheel.rotation.x = sim.distance / (isCar ? 0.4 : 0.36);

  if (isCar) {
    car.cabin.visible = !started || view !== 1;
    const steering = readInput().steer * 0.35;
    for (const pivot of car.frontPivots) pivot.rotation.y = steering;
    car.steering.rotation.z = -steering * 2;
    car.tail.emissiveIntensity = readInput().brake ? 2.2 : 0.55;
  } else {
    bike.handle.rotation.y = -sim.heading * 0.35;
    bike.rider.rotation.z = -sim.lean * 0.12;
    bike.rider.visible = view === 0 || view === 3 || !started;
  }

  const sx = Math.sin(heading), cz = Math.cos(heading);
  if (!started) {
    cameraPosition.set(bx + 9, by + 4.7, bz - origin - 13);
    cameraTarget.set(bx + 3, by + 1.7, bz - origin + 22);
  } else if (view === 0) {
    const back = isCar ? 8.8 : 6.5;
    cameraPosition.set(bx - sx * back, by + (isCar ? 3.4 : 2.65) + bump, bz - origin - cz * back);
    cameraTarget.set(bx + sx * 13, by + 1.15, bz - origin + cz * 13);
  } else if (view === 1) {
    const side = isCar ? 0.43 : 0, forward = isCar ? -0.35 : 0.05;
    cameraPosition.set(bx + sx * forward + cz * side, by + (isCar ? 1.58 : 1.96) + bump, bz - origin + cz * forward - sx * side);
    cameraTarget.set(bx + sx * 40 + cz * side, by + 1.4, bz - origin + cz * 40 - sx * side);
  } else if (view === 2) {
    const forward = isCar ? 1.2 : 0.22;
    cameraPosition.set(bx + sx * forward, by + (isCar ? 1.38 : 1.49) + bump, bz - origin + cz * forward);
    cameraTarget.set(bx + sx * 35, by + 1.3, bz - origin + cz * 35);
  } else {
    cameraPosition.set(bx - sx * 15 + Math.cos(heading) * 7, by + 7, bz - origin - cz * 15 - Math.sin(heading) * 7);
    cameraTarget.set(bx + sx * 17, by + 1.2, bz - origin + cz * 17);
  }

  if (started && shake && !paused) {
    const amount = sim.v / 50 * 0.01;
    cameraPosition.x += Math.sin(sim.distance * 1.7) * amount;
    cameraPosition.y += Math.sin(sim.distance * 3) * amount;
  }
  const blend = instant ? 1 : 1 - Math.exp(-dt * (view === 0 || view === 3 ? 5 : 16));
  camera.position.lerp(cameraPosition, blend);
  lookAt.lerp(cameraTarget, blend);
  camera.lookAt(lookAt);

  const fov = 58 + (started ? clamp(sim.v / 50, 0, 1) * 5 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  world.update(sim.s, camera, sceneryTime);
  sun.position.set(bx - 170, by + 270, bz - origin + 180);
  sun.target.position.set(bx, by, bz - origin + 15);
}
function updateUI() {
  $('speed').textContent = Math.round(sim.v * 3.6);
  $('gear').textContent = sim.gear || 'N';
  $('rpm').textContent = Math.round(sim.rpm / 100) * 100;
  $('rpmFill').style.width = `${clamp(sim.rpm / (sim.vehicle === 'car' ? 6500 : 10000) * 100, 0, 100)}%`;
  $('distance').textContent = (sim.distance / 1000).toFixed(2);
  $('lean').textContent = Math.round(Math.abs(sim.lean) * 180 / Math.PI);
  $('surface').textContent = sim.surfaceInfo.label;

  const biome = sim.biome;
  if ($('biomeLabel')) $('biomeLabel').textContent = BIOME_NAMES[biome] || '몽골의 초원';
  if (started && biome !== previousBiome) {
    previousBiome = biome;
    toast(`${BIOME_NAMES[biome]} 구간으로 접어듭니다.`);
  }

  $('fps').textContent = $('fpsToggle').checked ? `${Math.round(fps)} FPS` : '';
  $('fps').dataset.chunks = world.chunks.size;
  $('fps').dataset.created = world.stats.created;
  $('fps').dataset.disposed = world.stats.disposed;
  $('fps').dataset.geometries = renderer.info.memory.geometries;
  $('fps').dataset.drawCalls = renderer.info.render.calls;
  $('fps').dataset.flags = [...world.chunks.values()].reduce((n, c) => n + (c.userData.flags?.length || 0), 0);
  $('fps').dataset.goats = [...world.chunks.values()].reduce((n, c) => n + (c.userData.goats?.length || 0), 0);
  $('fps').dataset.vehicle = sim.vehicle;
  $('fps').dataset.view = view;
  $('fps').dataset.quality = config.quality;
  if (sim.recovery > 0) $('surface').textContent = '자세를 회복하고 있어요';
  updateCruise();
}
function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.1);
  last = now;
  fpsFrames++;
  fpsElapsed += elapsed;
  if (!paused) sceneryTime += elapsed;
  if (fpsElapsed >= 1) {
    fps = fpsFrames / fpsElapsed;
    fpsFrames = 0;
    fpsElapsed = 0;
  }
  if (started && !paused) {
    accumulator += elapsed;
    const input = readInput();
    while (accumulator >= 1 / 60) {
      sim.update(1 / 60, input);
      accumulator -= 1 / 60;
    }
    if (sim.recoveries !== previousRecoveries) {
      previousRecoveries = sim.recoveries;
      toast('괜찮아요. 도로로 돌아왔습니다.');
    }
  } else accumulator = 0;
  positionScene(elapsed);
  audio.update(sim, started && !paused);
  uiTimer += elapsed;
  if (uiTimer > 0.1) {
    updateUI();
    uiTimer = 0;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
async function start() {
  if (started) return;
  started = true;
  haptic(18);
  setMode($('startMode').value);
  $('welcome').classList.add('hidden');
  $('chapter').classList.add('hidden');
  $('rideUI').classList.remove('hidden');
  document.body.classList.add('started');
  positionScene(1, true);
  requestWakeLock();
  try {
    await audio.init();
  } catch {
    toast('소리를 시작할 수 없어요. 소리 버튼으로 다시 시도해 주세요.');
  }
  toast('당신의 속도로 달려보세요. 크루즈를 켜면 더 여유로워요.');
}
function syncVehicleUI() {
  $('startVehicle').value = sim.vehicle;
  $('vehicleSelect').value = sim.vehicle;
  bike.root.visible = sim.vehicle === 'bike';
  car.root.visible = sim.vehicle === 'car';
  for (const [i, name] of viewNames().entries()) $('cameraSelect').options[i].textContent = name;
  $('cameraSelect').value = String(view);
  $('leanLabel').textContent = sim.vehicle === 'car' ? '롤' : '린';
}
function setVehicle(type) {
  if (type === sim.vehicle) return;
  clearInput();
  haptic(15);
  sim.setVehicle(type);
  syncVehicleUI();
  positionScene(1, true);
  updateUI();
  saveSettings();
  if (started) toast(`${type === 'car' ? '자동차' : '오토바이'}로 바꿨어요. 정차 상태에서 다시 출발하세요.`);
}
function setView(value) {
  view = value;
  haptic(10);
  syncVehicleUI();
  positionScene(1, true);
  saveSettings();
  if (started) toast(`시점 · ${viewNames()[view]}`);
}
function changeView() { setView((view + 1) % 4); }

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('이 브라우저에서는 전체 화면 버튼을 지원하지 않아요.');
  } catch {
    toast('브라우저에서 전체 화면을 허용하지 않았어요.');
  }
}

$('startButton').addEventListener('click', start);
$('cameraSelect').addEventListener('change', e => setView(Number(e.target.value)));
$('vehicleSelect').addEventListener('change', e => setVehicle(e.target.value));
$('startVehicle').addEventListener('change', e => setVehicle(e.target.value));
$('pauseButton').addEventListener('click', () => setPause(!paused));
$('resumeButton').addEventListener('click', () => setPause(false));
$('pauseDialog').addEventListener('cancel', e => { e.preventDefault(); setPause(false); });
$('soundToggle').addEventListener('click', async () => {
  if (!audio.ctx) {
    try {
      await audio.init();
      audio.enabled = true;
    } catch {
      toast('이 브라우저에서 소리를 시작하지 못했어요.');
      return;
    }
  } else audio.enabled = !audio.enabled;
  updateSoundButton();
  saveSettings();
});
$('settingsButton').addEventListener('click', () => {
  if (started) setPause(true, false);
  clearInput();
  $('settingsDialog').showModal();
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
$('settingsDialog').addEventListener('close', () => { if (started) setPause(false); });
$('quality').addEventListener('change', e => {
  quality(e.target.value);
  toast('그래픽 품질을 변경했습니다.');
});
$('rideMode').addEventListener('change', e => setMode(e.target.value));
if ($('tiltToggle')) {
  $('tiltToggle').addEventListener('change', async e => {
    if (e.target.checked && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') {
          e.target.checked = false;
          toast('기기 기울기 센서 권한이 허용되지 않았어요.');
          return;
        }
      } catch {
        e.target.checked = false;
        return;
      }
    }
    tiltEnabled = e.target.checked;
    tiltSteer = 0;
    saveSettings();
    toast(tiltEnabled ? '기기 기울이기 조향을 켰어요. 좌우로 기울여 보세요.' : '기기 기울이기 조향을 껐어요.');
  });
}
$('hudToggle').addEventListener('change', e => {
  document.body.classList.toggle('hud-off', !e.target.checked);
  saveSettings();
});
$('shakeToggle').addEventListener('change', e => { shake = e.target.checked; saveSettings(); });
$('assistToggle').addEventListener('change', e => { sim.assist = e.target.checked; saveSettings(); });
$('engineVolume').addEventListener('input', e => { audio.engineVolume = e.target.value / 100; saveSettings(); });
$('windVolume').addEventListener('input', e => { audio.windVolume = e.target.value / 100; saveSettings(); });
$('resetButton').addEventListener('click', () => {
  sim.recover();
  toast('오른쪽 차로로 돌아왔습니다.');
  $('settingsDialog').close();
});
$('fullscreenButton').addEventListener('click', toggleFullscreen);
if ($('quickFullscreen')) $('quickFullscreen').addEventListener('click', toggleFullscreen);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if ($('installAppButton')) $('installAppButton').classList.remove('hidden');
});
if ($('installAppButton')) {
  $('installAppButton').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch {}
    deferredInstallPrompt = null;
    $('installAppButton').classList.add('hidden');
  });
}

window.addEventListener('deviceorientation', e => {
  if (!tiltEnabled || paused || !started) {
    tiltSteer = 0;
    return;
  }
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  let deg = e.gamma || 0;
  if (angle === 90) deg = e.beta || 0;
  else if (angle === -90 || angle === 270) deg = -(e.beta || 0);
  if (Math.abs(deg) < 2.2) tiltSteer = 0;
  else tiltSteer = clamp(-deg / 24, -1, 1);
});

document.querySelectorAll('[data-cruise]').forEach(b => b.addEventListener('click', () => {
  if (!started) return;
  haptic(14);
  sim.cruise = Number(b.dataset.cruise);
  updateCruise();
  toast(`${sim.cruise} km/h로 천천히 맞춥니다. 제동하면 해제됩니다.`);
}));
$('cruiseOff').addEventListener('click', () => { haptic(10); sim.cruise = 0; updateCruise(); });

window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || $('settingsDialog').open) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyC') changeView();
  else if (e.code === 'KeyV') setVehicle(sim.vehicle === 'bike' ? 'car' : 'bike');
  else if (e.code === 'KeyP' && !$('settingsDialog').open) setPause(!paused);
  else if (e.code === 'Escape' && started && !$('settingsDialog').open && !$('pauseDialog').open) setPause(true);
  else if (!paused) keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => {
  clearInput();
  if (started && !paused) setPause(true, false);
});
document.addEventListener('visibilitychange', () => {
  clearInput();
  if (document.hidden && started) {
    setPause(true, false);
    audio.update(sim, false);
    releaseWakeLock();
  }
});
window.addEventListener('focus', () => {
  if (started && paused && !$('settingsDialog').open && !$('pauseDialog').open) $('pauseDialog').showModal();
});
document.querySelectorAll('[data-input]').forEach(button => {
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (paused) return;
    haptic(10);
    button.setPointerCapture(e.pointerId);
    touch[button.dataset.input] = 1;
    button.classList.add('held');
  });
  const release = () => {
    touch[button.dataset.input] = 0;
    button.classList.remove('held');
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
});
// Touch / mouse / pen dragging on the open landscape smoothly steers analog-style.
$('scene').addEventListener('pointerdown', e => {
  if (!started || paused || steeringPointer !== null) return;
  steeringPointer = e.pointerId;
  dragStart = e.clientX;
  try { $('scene').setPointerCapture(e.pointerId); } catch {}
});
$('scene').addEventListener('pointermove', e => {
  if (e.pointerId === steeringPointer) dragSteer = clamp((dragStart - e.clientX) / 135, -1, 1);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('scene').addEventListener(event, e => {
    if (steeringPointer === null || e.pointerId === steeringPointer) {
      steeringPointer = null;
      dragSteer = 0;
    }
  });
}
$('scene').addEventListener('webglcontextlost', e => {
  e.preventDefault();
  setPause(true, false);
  error('3D 그래픽 연결이 중단됐습니다. 다른 탭을 닫거나 품질을 낮춘 뒤 다시 시작해 주세요.');
});
window.addEventListener('resize', resize);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
try {
  init();
} catch (err) {
  console.error(err);
  error('WebGL2 화면을 시작하지 못했습니다. 최신 브라우저에서 하드웨어 가속을 켜고 다시 시도해 주세요.');
}
