import * as T from './vendor/three.module.js';
import { noise, hash } from './simulation.js';

export function createGrassGeometry() {
  const positions = [], uvs = [];
  // A natural tuft of 7 curved, tapered blades with varied orientation and height.
  for (let b = 0; b < 7; b++) {
    const a = b * 2.39996, h = 0.17 + hash(b, 83) * 0.24, w = 0.01 + hash(b, 64) * 0.015;
    const ox = Math.cos(a) * 0.11, oz = Math.sin(a) * 0.11, dx = Math.cos(a), dz = Math.sin(a);
    const points = [];
    for (let j = 0; j < 3; j++) {
      const t = j / 2, cx = ox + dx * t * t * 0.12, cz = oz + dz * t * t * 0.12;
      points.push([cx - dz * w * (1 - t * 0.85), h * t, cz + dx * w * (1 - t * 0.85)], [cx + dz * w * (1 - t * 0.85), h * t, cz - dx * w * (1 - t * 0.85)]);
    }
    for (const i of [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]) {
      positions.push(...points[i]);
      uvs.push(i % 2, Math.floor(i / 2) / 2);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

export function createMountains() {
  const root = new T.Group(), p = [], colors = [], indices = [], angles = 256, radii = [1450, 1950, 2550, 3250, 4050, 4950, 6150, 7650, 9300];
  const color = new T.Color();
  for (let r = 0; r < radii.length; r++) for (let i = 0; i <= angles; i++) {
    const a = i / angles * Math.PI * 2, x = Math.cos(a), z = Math.sin(a), rad = radii[r];
    const ridge = Math.pow(noise(x * 4.7 + 21, z * 4.7 + 19), 1.32) * 390 + noise(x * 13 + 7, z * 13) * 175 + noise(x * 39, z * 39) * 62;
    const profile = [-36, -15, 0.15, 0.65, 1.05, 0.68, 0.44, 0.60, 0.22][r];
    const y = r < 2 ? profile : ridge * profile + noise(x * 17 + r * 3, z * 17 + r * 2) * 98;
    p.push(x * rad, y, z * rad);

    // Snow caps on high peaks and atmospheric depth layering across mountain rings
    const snow = y > 265 ? Math.min(1, (y - 265) / 110) : 0;
    color.setHSL(0.55 - r * 0.003, 0.18 + noise(x * 8 + r, z * 8) * 0.05, 0.12 + r * 0.011 + noise(x * 25 + r, z * 25) * 0.035);
    if (r === 0) color.set(0x7c865b);
    else if (r === 1) color.set(0x889370);
    if (snow > 0) color.lerp(new T.Color(0xebf1f5), snow * 0.72);
    // Distance atmospheric blue-grey aerial perspective
    if (r >= 4) color.lerp(new T.Color(0xb8cbd6), (r - 3) * 0.11);
    colors.push(color.r, color.g, color.b);
    if (r < radii.length - 1 && i < angles) {
      const k = r * (angles + 1) + i;
      indices.push(k, k + 1, k + angles + 1, k + 1, k + angles + 2, k + angles + 1);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02, side: T.DoubleSide }));
  mesh.frustumCulled = false;
  root.add(mesh);
  const floor = new T.Mesh(new T.CircleGeometry(9600, 96), new T.MeshStandardMaterial({ color: 0x8c946d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -40;
  root.add(floor);
  return root;
}

export function createFlag(texture) {
  const group = new T.Group();
  group.userData.dynamic = true;
  const metal = new T.MeshStandardMaterial({ color: 0xc2c4ba, metalness: 0.82, roughness: 0.22 });
  const gold = new T.MeshStandardMaterial({ color: 0xe6be4a, metalness: 0.85, roughness: 0.2 });
  const pole = new T.Mesh(new T.CylinderGeometry(0.055, 0.095, 8.6, 16), metal);
  pole.position.y = 4.3;
  pole.castShadow = true;
  group.add(pole);
  const base = new T.Mesh(new T.CylinderGeometry(0.42, 0.56, 0.36, 16), new T.MeshStandardMaterial({ color: 0x94917a, roughness: 0.95 }));
  base.position.y = 0.18;
  base.receiveShadow = true;
  group.add(base);
  const ball = new T.Mesh(new T.SphereGeometry(0.14, 16, 12), gold);
  ball.position.y = 8.68;
  group.add(ball);
  // 2:1 official aspect ratio (4.6m x 2.3m)
  const geo = new T.PlaneGeometry(4.6, 2.3, 28, 14);
  geo.translate(2.31, 0, 0);
  const flag = new T.Mesh(geo, new T.MeshStandardMaterial({ map: texture, roughness: 0.82, side: T.DoubleSide, metalness: 0.02 }));
  flag.position.y = 7.2;
  flag.rotation.y = Math.PI + 0.12;
  flag.castShadow = true;
  flag.frustumCulled = false;
  flag.userData.rest = geo.attributes.position.array.slice();
  group.add(flag);
  group.userData.flag = flag;
  return group;
}

export function createGoat(seed, batch, furTexture, shadowMaterial) {
  const goat = new T.Group();
  goat.userData.dynamic = true;
  const palettes = [0xd8cdb2, 0xe8e2d0, 0x8c6e4b, 0xa4957b, 0xcab794, 0x5d5246];
  const fur = new T.MeshStandardMaterial({ color: palettes[Math.abs(seed) % palettes.length], roughness: 0.94, bumpMap: furTexture, bumpScale: 0.032 });
  const dark = new T.MeshStandardMaterial({ color: 0x2a2720, roughness: 0.88 });
  const horn = new T.MeshStandardMaterial({ color: 0x766c54, roughness: 0.72, metalness: 0.08 });
  const eye = new T.MeshStandardMaterial({ color: 0x130f0b, roughness: 0.2 });
  const inner = new T.MeshStandardMaterial({ color: 0xad8b6e, roughness: 0.95 });

  const bodyRoot = new T.Group(), parts = new T.Group();
  bodyRoot.add(parts);
  goat.add(bodyRoot);
  const head = new T.Group(), headParts = new T.Group();
  head.add(headParts);
  head.position.set(0.52, 1.04, 0);
  head.rotation.z = -0.12;
  goat.add(head);

  function ellipsoid(parent, r, pos, scale, mat) {
    const o = new T.Mesh(new T.SphereGeometry(r, 18, 12), mat);
    o.position.set(...pos);
    o.scale.set(...scale);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function segment(parent, a, b, r1, r2, mat) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const o = new T.Mesh(new T.CylinderGeometry(r2, r1, delta.length(), 10), mat);
    o.position.copy(start).add(end).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    o.castShadow = true;
    parent.add(o);
    return o;
  }

  // Torso, rump, chest, and neck
  ellipsoid(parts, 1, [0, 0.87, 0], [0.61, 0.32, 0.25], fur);
  ellipsoid(parts, 1, [-0.33, 0.87, 0], [0.26, 0.33, 0.26], fur);
  ellipsoid(parts, 1, [0.36, 0.94, 0], [0.26, 0.36, 0.24], fur);
  segment(parts, [0.36, 0.83, 0], [0.55, 1.18, 0], 0.19, 0.13, fur);

  // Articulated legs with knees and split hooves
  for (const x of [-0.38, 0.36]) for (const z of [-0.18, 0.18]) {
    const knee = x < 0 ? x + 0.12 : x - 0.04;
    segment(parts, [x, 0.83, z], [knee, 0.43, z], 0.076, 0.048, fur);
    segment(parts, [knee, 0.43, z], [x + 0.02, 0.085, z], 0.048, 0.032, fur);
    for (const dz of [-0.023, 0.023]) {
      const hoof = new T.Mesh(new T.BoxGeometry(0.13, 0.09, 0.039), dark);
      hoof.position.set(x + 0.045, 0.048, z + dz);
      parts.add(hoof);
    }
  }
  const tailPath = new T.CatmullRomCurve3([new T.Vector3(-0.53, 1, 0), new T.Vector3(-0.72, 1.16, 0), new T.Vector3(-0.78, 1.3, 0.015)]);
  parts.add(new T.Mesh(new T.TubeGeometry(tailPath, 7, 0.046, 6, false), fur));

  // Head, muzzle, nostrils, ears, eyes, swept horns, and chin beard
  ellipsoid(headParts, 1, [0.08, 0.13, 0], [0.145, 0.23, 0.145], fur);
  ellipsoid(headParts, 1, [0.21, -0.015, 0], [0.195, 0.11, 0.105], fur);
  ellipsoid(headParts, 1, [0.33, -0.035, 0], [0.048, 0.06, 0.092], dark);
  for (const side of [-1, 1]) {
    const ear = ellipsoid(headParts, 1, [-0.015, 0.19, side * 0.235], [0.15, 0.045, 0.165], fur);
    ear.rotation.x = side * 0.3;
    ear.rotation.y = side * 0.35;
    const inside = ellipsoid(headParts, 1, [0.01, 0.202, side * 0.25], [0.105, 0.018, 0.115], inner);
    inside.rotation.x = side * 0.3;
    ellipsoid(headParts, 0.026, [0.15, 0.16, side * 0.122], [1, 0.77, 0.65], eye);
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-0.01, 0.28, side * 0.095),
      new T.Vector3(-0.035, 0.5, side * 0.13),
      new T.Vector3(-0.18, 0.69, side * 0.16),
      new T.Vector3(-0.35, 0.77, side * 0.185),
      new T.Vector3(-0.44, 0.74, side * 0.19),
    ]);
    const hornMesh = new T.Mesh(new T.TubeGeometry(curve, 14, 0.034, 8, false), horn);
    hornMesh.castShadow = true;
    headParts.add(hornMesh);
  }
  const beard = new T.Mesh(new T.ConeGeometry(0.062, 0.26, 9), fur);
  beard.position.set(0.19, -0.21, 0);
  beard.rotation.z = Math.PI - 0.15;
  headParts.add(beard);

  batch(bodyRoot);
  batch(head);
  const shadow = new T.Mesh(new T.PlaneGeometry(2, 1.3), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  goat.add(shadow);
  const scale = 0.9 + hash(seed, 31) * 0.22;
  goat.scale.setScalar(scale);
  goat.rotation.y = -0.4 + hash(seed, 51) * 1.1;
  goat.userData.head = head;
  goat.userData.phase = hash(seed, 37) * Math.PI * 2;
  return goat;
}

export function createHorse(seed, batch, furTexture, shadowMaterial) {
  const horse = new T.Group();
  horse.userData.dynamic = true;
  const coats = [0x6e472b, 0x8b5733, 0x322c28, 0xd8d1c2, 0xa88459];
  const coat = new T.MeshStandardMaterial({ color: coats[Math.abs(seed) % coats.length], roughness: 0.86, bumpMap: furTexture, bumpScale: 0.018 });
  const maneMat = new T.MeshStandardMaterial({ color: 0x221e1a, roughness: 0.95 });

  const bodyRoot = new T.Group(), parts = new T.Group();
  bodyRoot.add(parts);
  horse.add(bodyRoot);
  const head = new T.Group(), headParts = new T.Group();
  head.add(headParts);
  head.position.set(0.75, 1.38, 0);
  head.rotation.z = -0.08;
  horse.add(head);

  function ellipsoid(parent, r, pos, scale, mat) {
    const o = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat);
    o.position.set(...pos);
    o.scale.set(...scale);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  function segment(parent, a, b, r1, r2, mat) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const o = new T.Mesh(new T.CylinderGeometry(r2, r1, delta.length(), 10), mat);
    o.position.copy(start).add(end).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    o.castShadow = true;
    parent.add(o);
    return o;
  }

  ellipsoid(parts, 1, [0, 1.18, 0], [0.82, 0.38, 0.33], coat);
  ellipsoid(parts, 1, [-0.48, 1.2, 0], [0.36, 0.38, 0.34], coat);
  ellipsoid(parts, 1, [0.5, 1.22, 0], [0.35, 0.4, 0.32], coat);
  for (const x of [-0.52, 0.52]) for (const z of [-0.2, 0.2]) {
    segment(parts, [x, 1.05, z], [x, 0.54, z], 0.095, 0.062, coat);
    segment(parts, [x, 0.54, z], [x + 0.02, 0.08, z], 0.06, 0.045, coat);
    const hoof = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 0.09, 8), maneMat);
    hoof.position.set(x + 0.025, 0.045, z);
    parts.add(hoof);
  }
  const tailCurve = new T.CatmullRomCurve3([new T.Vector3(-0.78, 1.22, 0), new T.Vector3(-1.02, 0.95, 0), new T.Vector3(-1.08, 0.52, 0.02)]);
  parts.add(new T.Mesh(new T.TubeGeometry(tailCurve, 8, 0.065, 7, false), maneMat));

  // Neck, mane, head, ears
  segment(headParts, [-0.22, -0.22, 0], [0.16, 0.34, 0], 0.22, 0.15, coat);
  segment(headParts, [-0.28, -0.1, 0], [0.08, 0.42, 0], 0.06, 0.05, maneMat);
  ellipsoid(headParts, 1, [0.32, 0.35, 0], [0.28, 0.14, 0.13], coat);
  ellipsoid(headParts, 1, [0.52, 0.28, 0], [0.12, 0.09, 0.1], maneMat);
  for (const side of [-1, 1]) {
    const ear = new T.Mesh(new T.ConeGeometry(0.04, 0.14, 7), coat);
    ear.position.set(0.16, 0.52, side * 0.09);
    ear.rotation.z = -0.2;
    headParts.add(ear);
  }

  batch(bodyRoot);
  batch(head);
  const shadow = new T.Mesh(new T.PlaneGeometry(2.6, 1.5), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  horse.add(shadow);
  const scale = 0.95 + hash(seed, 19) * 0.18;
  horse.scale.setScalar(scale);
  horse.rotation.y = hash(seed, 43) * 6.28;
  horse.userData.head = head;
  horse.userData.phase = hash(seed, 71) * Math.PI * 2;
  return horse;
}

export function createCamel(seed, batch, furTexture, shadowMaterial) {
  const camel = new T.Group();
  camel.userData.dynamic = true;
  const palettes = [0xb88e58, 0xa47b47, 0xc79f69];
  const fur = new T.MeshStandardMaterial({ color: palettes[Math.abs(seed) % palettes.length], roughness: 0.95, bumpMap: furTexture, bumpScale: 0.025 });
  const dark = new T.MeshStandardMaterial({ color: 0x3b2f23, roughness: 0.9 });

  const bodyRoot = new T.Group(), parts = new T.Group();
  bodyRoot.add(parts);
  camel.add(bodyRoot);
  const head = new T.Group(), headParts = new T.Group();
  head.add(headParts);
  head.position.set(0.88, 1.55, 0);
  camel.add(head);

  function ellipsoid(parent, r, pos, scale, mat) {
    const o = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat);
    o.position.set(...pos);
    o.scale.set(...scale);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  function segment(parent, a, b, r1, r2, mat) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const o = new T.Mesh(new T.CylinderGeometry(r2, r1, delta.length(), 10), mat);
    o.position.copy(start).add(end).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    o.castShadow = true;
    parent.add(o);
    return o;
  }

  // Bactrian two-humped camel body
  ellipsoid(parts, 1, [0, 1.48, 0], [0.95, 0.45, 0.38], fur);
  ellipsoid(parts, 1, [-0.34, 2.02, 0], [0.28, 0.36, 0.25], fur);
  ellipsoid(parts, 1, [0.32, 2.04, 0], [0.28, 0.38, 0.25], fur);
  for (const x of [-0.58, 0.58]) for (const z of [-0.22, 0.22]) {
    segment(parts, [x, 1.28, z], [x, 0.65, z], 0.11, 0.07, fur);
    segment(parts, [x, 0.65, z], [x, 0.08, z], 0.07, 0.055, fur);
    ellipsoid(parts, 1, [x + 0.03, 0.05, z], [0.09, 0.05, 0.08], dark);
  }
  // Curved S-neck and head
  segment(headParts, [-0.15, -0.2, 0], [0.12, -0.42, 0], 0.2, 0.16, fur);
  segment(headParts, [0.12, -0.42, 0], [0.35, 0.35, 0], 0.16, 0.12, fur);
  ellipsoid(headParts, 1, [0.5, 0.42, 0], [0.25, 0.13, 0.13], fur);

  batch(bodyRoot);
  batch(head);
  const shadow = new T.Mesh(new T.PlaneGeometry(2.9, 1.6), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  camel.add(shadow);
  const scale = 0.96 + hash(seed, 29) * 0.16;
  camel.scale.setScalar(scale);
  camel.rotation.y = hash(seed, 61) * 6.28;
  camel.userData.head = head;
  camel.userData.phase = hash(seed, 83) * Math.PI * 2;
  return camel;
}

export function createOvoo(seed, batch) {
  const ovoo = new T.Group();
  const rocks = new T.Group();
  ovoo.add(rocks);
  const woodMat = new T.MeshStandardMaterial({ color: 0x6e5339, roughness: 0.92 });
  const blueSilk = new T.MeshStandardMaterial({ color: 0x1d68c4, roughness: 0.65, side: T.DoubleSide });
  const goldSilk = new T.MeshStandardMaterial({ color: 0xe3b93b, roughness: 0.65, side: T.DoubleSide });

  for (let i = 0; i < 46; i++) {
    const h = hash(seed, i + 10) * 1.55;
    const rad = (2.1 * (1 - h / 1.95)) * Math.sqrt(hash(seed, i + 70));
    const a = hash(seed, i + 130) * Math.PI * 2;
    const s = 0.24 + hash(seed, i + 190) * 0.34;
    const tone = 0.48 + hash(seed, i + 250) * 0.22;
    const rMat = new T.MeshStandardMaterial({ color: new T.Color(tone, tone * 0.98, tone * 0.9), roughness: 0.95 });
    const stone = new T.Mesh(new T.DodecahedronGeometry(1, 0), rMat);
    stone.position.set(Math.cos(a) * rad, h + 0.18, Math.sin(a) * rad);
    stone.scale.set(s * 1.3, s * 0.85, s * 1.15);
    stone.rotation.set(hash(seed, i) * 3, hash(seed, i + 5) * 3, 0);
    stone.castShadow = true;
    stone.receiveShadow = true;
    rocks.add(stone);
  }
  const centerPole = new T.Mesh(new T.CylinderGeometry(0.06, 0.1, 3.6, 8), woodMat);
  centerPole.position.y = 2.6;
  centerPole.castShadow = true;
  rocks.add(centerPole);

  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const scarf = new T.Mesh(new T.PlaneGeometry(1.6, 0.26, 6, 1), i % 2 === 0 ? blueSilk : goldSilk);
    scarf.position.set(Math.cos(a) * 0.75, 3.5 - i * 0.15, Math.sin(a) * 0.75);
    scarf.rotation.set(0.25, -a, -0.42);
    rocks.add(scarf);
  }
  batch(rocks);
  return ovoo;
}

const PLACES = ['Улаанбаатар', 'Хархорин', 'Даланзадгад', 'Мөрөн', 'Чойбалсан'];
const signTextures = new Map();

function getSignTexture(index) {
  const key = index % 3;
  if (signTextures.has(index)) return signTextures.get(index);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (key === 0) {
    ctx.fillStyle = '#0e58a8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 246, 118);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText(PLACES[Math.abs(index) % PLACES.length], 128, 54);
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.fillText(`${25 + (Math.abs(index * 19) % 180)} км`, 128, 102);
  } else {
    ctx.fillStyle = '#0e58a8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 246, 118);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(68, 64, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#d62828';
    ctx.stroke();
    ctx.fillStyle = '#141414';
    ctx.textAlign = 'center';
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.fillText(key === 1 ? '80' : '100', 68, 79);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('MONGOLIA', 172, 60);
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText('A0101', 172, 90);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  if (signTextures.size > 24) signTextures.delete(signTextures.keys().next().value);
  signTextures.set(index, tex);
  return tex;
}

export function createRoadSign(index) {
  const group = new T.Group();
  group.userData.dynamic = true;
  const postMat = new T.MeshStandardMaterial({ color: 0x9aa09a, metalness: 0.65, roughness: 0.42 });
  for (const dx of [-0.55, 0.55]) {
    const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 2.5, 8), postMat);
    post.position.set(dx, 1.25, 0);
    post.castShadow = true;
    group.add(post);
  }
  const board = new T.Mesh(
    new T.BoxGeometry(1.75, 0.88, 0.04),
    new T.MeshStandardMaterial({ map: getSignTexture(index), roughness: 0.48, metalness: 0.12 })
  );
  board.position.set(0, 2.2, 0);
  board.castShadow = true;
  group.add(board);
  return group;
}

export function createContactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
  g.addColorStop(0, 'rgba(25,30,16,.36)');
  g.addColorStop(0.45, 'rgba(25,30,16,.22)');
  g.addColorStop(1, 'rgba(25,30,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
}
