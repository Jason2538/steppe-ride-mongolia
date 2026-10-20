import * as T from './vendor/three.module.js';
import { roadX, roadY, roadSlope, terrainY, noise, hash, smooth, gobiFactor, waterFactor, roadSurfaceAt } from './simulation.js';
import { HDRLoader } from './vendor/HDRLoader.js';
import { createGrassGeometry, createMountains, createFlag, createGoat, createHorse, createCamel, createOvoo, createRoadSign, createContactShadow } from './scenery.js';

export const QUALITY = {
  low:    { ahead: 6,  grass: 1800,  pixel: 1,    shadow: 512,  aniso: 2 },
  medium: { ahead: 9,  grass: 5000,  pixel: 1.5,  shadow: 1536, aniso: 6 },
  high:   { ahead: 12, grass: 9000,  pixel: 2,    shadow: 2048, aniso: 10 },
  ultra:  { ahead: 15, grass: 14500, pixel: 2.25, shadow: 4096, aniso: 16 },
};

const SIZE = 240;
const TERRAIN_XS = [-2400, -1900, -1450, -1050, -750, -510, -340, -220, -140, -85, -50, -30, -18, -10, -6, -3, 0, 3, 6, 10, 18, 30, 50, 85, 140, 220, 340, 510, 750, 1050, 1450, 1900, 2400];
const surfaceRows = new Map();

function surfaceRow(s) {
  if (!surfaceRows.has(s)) {
    surfaceRows.set(s, TERRAIN_XS.map(d => terrainY(roadX(s) + d, s)));
    if (surfaceRows.size > 256) surfaceRows.delete(surfaceRows.keys().next().value);
  }
  return surfaceRows.get(s);
}

export function terrainSurfaceY(x, s) {
  // Match the rendered triangles, so hooves, tent bases and grass roots sit on the ground.
  const step = SIZE / 32, s0 = Math.floor(s / step) * step, s1 = s0 + step, t = (s - s0) / step;
  const d = x - (roadX(s0) * (1 - t) + roadX(s1) * t);
  let i = 0;
  while (i < TERRAIN_XS.length - 2 && d > TERRAIN_XS[i + 1]) i++;
  const a = TERRAIN_XS[i], b = TERRAIN_XS[i + 1], u = Math.max(0, Math.min(1, (d - a) / (b - a)));
  const row0 = surfaceRow(s0), row1 = surfaceRow(s1), y00 = row0[i], y10 = row0[i + 1], y01 = row1[i], y11 = row1[i + 1];
  return t + u <= 1 ? y00 * (1 - t - u) + y10 * u + y01 * t : y11 * (t + u - 1) + y10 * (1 - t) + y01 * (1 - u);
}

function texture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d'), im = ctx.getImageData(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const h = hash(x, y), q = noise(x / 17, y / 17), i = (y * 256 + x) * 4;
    const base = kind === 'road' ? 72 : kind === 'earth' ? 145 : 134;
    const n = kind === 'road' ? h * 20 - 10 : (h - 0.5) * 35 + (q - 0.5) * 40;
    im.data[i] = base + n;
    im.data[i + 1] = base + n + (kind === 'grass' ? 12 : kind === 'earth' ? -8 : 1);
    im.data[i + 2] = base + n + (kind === 'grass' ? -32 : kind === 'earth' ? -29 : 3);
    im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const tx = new T.CanvasTexture(c);
  tx.wrapS = tx.wrapT = T.RepeatWrapping;
  tx.colorSpace = T.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

function ribbon(s0, length, left, right, step = 6, yOffset = 0.03) {
  const count = Math.ceil(length / step), p = [], uv = [], indices = [];
  for (let j = 0; j <= count; j++) {
    const s = s0 + length * j / count, x = roadX(s), y = roadY(s) + yOffset, angle = Math.atan(roadSlope(s));
    for (const d of [left, right]) {
      p.push(x + d * Math.cos(angle), y, s - d * Math.sin(angle));
      uv.push(d / 3, s / 3);
    }
    if (j < count) {
      const a = j * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const dummy = new T.Object3D();

export class SteppeWorld {
  constructor(scene, quality = 'ultra', renderer) {
    this.scene = scene;
    this.quality = QUALITY[quality] ? quality : 'ultra';
    this.renderer = renderer;
    this.chunks = new Map();
    this.origin = 0;
    this.stats = { created: 0, disposed: 0 };

    this.grassTex = texture('grass');
    this.roadTex = texture('road');
    this.earthTex = texture('earth');
    this.furTex = texture('earth');

    // Terrain material with multi-scale anti-tiling shader and vertex-colored biome blending
    this.terrainMat = new T.MeshStandardMaterial({ map: this.grassTex, vertexColors: true, roughness: 0.93, metalness: 0.02 });
    this.terrainMat.envMapIntensity = 0.26;
    this.terrainMat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 tex1 = texture2D( map, vMapUv );
          vec4 tex2 = texture2D( map, vMapUv * 0.19 + vec2(0.37, 0.61) );
          vec3 combinedTex = mix( tex1.rgb, tex1.rgb * tex2.rgb * 2.15, 0.42 );
          float texLum = dot( combinedTex, vec3(0.2126, 0.7152, 0.0722) );
          vec3 albedoBase = mix( combinedTex * 1.45, vec3(0.84, 0.93, 0.62) * (0.38 + texLum * 1.95), 0.78 );
          diffuseColor.rgb *= albedoBase;
        #endif
      `);
    };

    // Distinct road surface materials (PBR normal maps loaded asynchronously below)
    this.roadMats = {
      asphalt: new T.MeshStandardMaterial({ map: this.roadTex, color: 0x939691, roughness: 0.84, metalness: 0.04, envMapIntensity: 0.28 }),
      cracked: new T.MeshStandardMaterial({ map: this.roadTex, color: 0xa2a098, roughness: 0.90, metalness: 0.02, envMapIntensity: 0.22 }),
      gravel:  new T.MeshStandardMaterial({ map: this.earthTex, color: 0xc2b69f, roughness: 0.95, metalness: 0.01, envMapIntensity: 0.16 }),
      dirt:    new T.MeshStandardMaterial({ map: this.earthTex, color: 0xb59b78, roughness: 0.97, metalness: 0.01, envMapIntensity: 0.12 }),
    };
    this.roadMat = this.roadMats.asphalt;
    this.earthMat = new T.MeshStandardMaterial({ map: this.earthTex, color: 0xc2b79d, roughness: 0.96, envMapIntensity: 0.15 });
    this.lineMat = new T.MeshStandardMaterial({ color: 0xdedcc8, roughness: 0.88 });
    this.poleMat = new T.MeshStandardMaterial({ color: 0x6f6449, roughness: 0.95 });
    this.rockMat = new T.MeshStandardMaterial({ color: 0x999a86, roughness: 0.94 });
    this.waterMat = new T.MeshPhysicalMaterial({
      color: 0x3b6e8c,
      roughness: 0.14,
      metalness: 0.12,
      transmission: 0.25,
      reflectivity: 0.88,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.15,
    });

    this.grassMat = new T.MeshStandardMaterial({ color: 0xc2c585, roughness: 0.88, side: T.DoubleSide });
    this.windUniform = { value: 0 };
    this.grassMat.onBeforeCompile = shader => {
      shader.uniforms.steppeTime = this.windUniform;
      shader.vertexShader = 'uniform float steppeTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float phase = instanceMatrix[3].x * 0.43 + instanceMatrix[3].z * 0.31;
        transformed.x += sin(steppeTime * 1.55 + phase) * position.y * position.y * 0.16;
        transformed.z += cos(steppeTime * 1.15 + phase) * position.y * position.y * 0.10;
        #endif`);
    };

    this.grassGeo = createGrassGeometry();
    this.rockGeo = new T.DodecahedronGeometry(1, 1);
    this.poleGeo = new T.CylinderGeometry(0.085, 0.13, 7.8, 6);
    this.crossGeo = new T.BoxGeometry(2.1, 0.11, 0.12);
    this.shadowMat = createContactShadow();

    this.flagTexture = new T.TextureLoader().load('./assets/mongolia.svg');
    this.flagTexture.colorSpace = T.SRGBColorSpace;
    this.flagTexture.anisotropy = 8;

    this.makeSky();
    this.makeClouds();
    this.mountains = createMountains();
    this.scene.add(this.mountains);
    this.loadPhotographicMaterials(renderer);
  }

  loadPhotographicMaterials(renderer) {
    const loader = new T.TextureLoader();
    const maxAniso = Math.min(QUALITY[this.quality]?.aniso || 12, renderer?.capabilities.getMaxAnisotropy() || 4);
    const load = (name, color = true) => {
      const tex = loader.load(`./assets/${name}`);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.anisotropy = maxAniso;
      if (color) tex.colorSpace = T.SRGBColorSpace;
      return tex;
    };

    // High-res PBR terrain maps (Poly Haven CC0)
    this.terrainMat.map = load('sparse_grass_diff_1k.jpg');
    this.terrainMat.normalMap = load('sparse_grass_nor_gl_1k.jpg', false);
    this.terrainMat.normalScale.set(0.68, 0.68);
    this.terrainMat.needsUpdate = true;

    // Road shoulders / gravel transition
    this.earthMat.map = load('sandy_gravel_02_diff.jpg');
    this.earthMat.normalMap = load('sandy_gravel_02_nor.jpg', false);
    this.earthMat.normalScale.set(0.75, 0.75);
    this.earthMat.needsUpdate = true;

    // 4 road surface PBR materials
    this.roadMats.asphalt.map = load('asphalt_04_diff.jpg');
    this.roadMats.asphalt.normalMap = load('asphalt_04_nor.jpg', false);
    this.roadMats.asphalt.normalScale.set(0.55, 0.55);
    this.roadMats.asphalt.needsUpdate = true;

    this.roadMats.cracked.map = load('asphalt_02_diff_1k.jpg');
    this.roadMats.cracked.normalMap = load('asphalt_02_nor_gl_1k.jpg', false);
    this.roadMats.cracked.normalScale.set(0.72, 0.72);
    this.roadMats.cracked.needsUpdate = true;

    this.roadMats.gravel.map = load('gravel_road_diff.jpg');
    this.roadMats.gravel.normalMap = load('gravel_road_nor.jpg', false);
    this.roadMats.gravel.normalScale.set(0.95, 0.95);
    this.roadMats.gravel.needsUpdate = true;

    this.roadMats.dirt.map = load('dirt_floor_diff.jpg');
    this.roadMats.dirt.normalMap = load('dirt_floor_nor.jpg', false);
    this.roadMats.dirt.normalScale.set(0.88, 0.88);
    this.roadMats.dirt.needsUpdate = true;

    // Water subtle normal ripple
    this.waterMat.normalMap = this.terrainMat.normalMap;
    this.waterMat.normalScale.set(0.18, 0.18);

    loader.load('./assets/sky_4k.jpg', sky => {
      sky.colorSpace = T.SRGBColorSpace;
      sky.mapping = T.EquirectangularReflectionMapping;
      this.scene.background = sky;
      this.scene.backgroundIntensity = 0.94;
      this.scene.backgroundRotation.y = 0.75;
      this.sky.visible = false;
      this.clouds.visible = false;
    });

    if (renderer) new HDRLoader().load('./assets/sky_1k.hdr', hdr => {
      hdr.mapping = T.EquirectangularReflectionMapping;
      const pmrem = new T.PMREMGenerator(renderer);
      this.environment = pmrem.fromEquirectangular(hdr);
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = this.quality === 'ultra' ? 0.34 : 0.24;
      pmrem.dispose();
    }, undefined, () => {
      console.warn('HDR sky unavailable; using procedural fallback.');
    });
  }

  makeSky() {
    const mat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { sun: { value: new T.Vector3(-0.45, 0.68, 0.54).normalize() } },
      vertexShader: `varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 dir;uniform vec3 sun;void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 c=mix(vec3(.80,.85,.77),vec3(.31,.59,.71),pow(h,.46));float sd=max(dot(d,sun),0.);c+=vec3(1.,.83,.53)*pow(sd,2200.)*.8;c+=vec3(.27,.22,.13)*pow(sd,12.);gl_FragColor=vec4(c,1.);}`,
    });
    this.sky = new T.Mesh(new T.SphereGeometry(9000, 24, 14), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -5;
    this.scene.add(this.sky);
  }

  makeClouds() {
    this.clouds = new T.Group();
    this.scene.add(this.clouds);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 28; i++) {
      const x = 35 + hash(i, 3) * 185, y = 35 + hash(i, 8) * 57, r = 20 + hash(i, 10) * 27;
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,246,.32)');
      g.addColorStop(0.5, 'rgba(255,255,246,.21)');
      g.addColorStop(1, 'rgba(255,255,246,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    const mat = new T.SpriteMaterial({ map: tx, transparent: true, opacity: 0.86, depthWrite: false, fog: true, color: 0xf6f6e8 });
    for (let i = 0; i < 30; i++) {
      const cloud = new T.Sprite(mat);
      cloud.position.set((hash(i, 42) - 0.5) * 8500, 650 + hash(i, 51) * 950, (hash(i, 62) - 0.5) * 8500);
      cloud.scale.set(900 + hash(i, 7) * 1100, 290 + hash(i, 3) * 230, 1);
      this.clouds.add(cloud);
    }
  }

  setQuality(q) {
    if (!QUALITY[q] || q === this.quality) return;
    this.quality = q;
    this.scene.environmentIntensity = q === 'ultra' ? 0.34 : 0.24;
    for (const [i, c] of this.chunks) this.disposeChunk(i, c);
    this.chunks.clear();
  }

  terrain(s0) {
    const xs = TERRAIN_XS, nz = 32, p = [], colors = [], uv = [], ix = [];
    const c = new T.Color();
    for (let j = 0; j <= nz; j++) {
      const s = s0 + j * SIZE / nz;
      const gobi = gobiFactor(s), water = waterFactor(s);
      for (let i = 0; i < xs.length; i++) {
        const x = roadX(s) + xs[i], y = terrainY(x, s), d = Math.abs(xs[i]);
        p.push(x, y, s - s0);
        uv.push(x / 3.5, s / 3.5);
        const n = noise(x / 180, s / 180), dry = noise(x / 350 + 61, s / 350 + 44);

        // Steppe lush meadow -> Golden dry steppe -> Gobi desert sand/gravel transition
        c.setRGB(0.66 + n * 0.28 + dry * 0.14, 0.77 + n * 0.22 - dry * 0.05, 0.46 + dry * 0.18);
        if (gobi > 0.01) {
          const sand = new T.Color(0.88 + n * 0.15, 0.74 + n * 0.12, 0.52 + dry * 0.1);
          c.lerp(sand, gobi * 0.88);
        }
        if (water > 0.05 && xs[i] > 14 && xs[i] < 480) {
          const shore = new T.Color(0.76, 0.73, 0.60);
          c.lerp(shore, water * 0.7);
        }
        if (d < 6.8) c.lerp(new T.Color(0xa69d7b), 1 - smooth(5.2, 6.8, d));
        c.lerp(new T.Color(0xafb8b2), smooth(500, 2300, d) * 0.48);
        colors.push(c.r, c.g, c.b);
        if (j < nz && i < xs.length - 1) {
          const a = j * xs.length + i;
          ix.push(a, a + xs.length, a + 1, a + 1, a + xs.length, a + xs.length + 1);
        }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    return new T.Mesh(geo, this.terrainMat);
  }

  makeGer(x, s, scale = 1) {
    const ger = new T.Group();
    const felt = new T.MeshStandardMaterial({ color: 0xebe3cd, roughness: 0.94 });
    const trim = new T.MeshStandardMaterial({ color: 0x6b4e37, roughness: 0.88 });
    const redWood = new T.MeshStandardMaterial({ color: 0x8e3b28, roughness: 0.82 });
    const orangeCrown = new T.MeshStandardMaterial({ color: 0xc66b27, roughness: 0.78 });
    const solarMat = new T.MeshStandardMaterial({ color: 0x1c3554, metalness: 0.65, roughness: 0.25 });

    // Cylindrical felt wall & domed cone roof
    const body = new T.Mesh(new T.CylinderGeometry(3.25, 3.35, 2.15, 28), felt);
    body.position.y = 1.08;
    body.castShadow = true;
    body.receiveShadow = true;
    ger.add(body);

    const roof = new T.Mesh(new T.ConeGeometry(3.4, 1.75, 28), felt);
    roof.position.y = 3.02;
    roof.castShadow = true;
    ger.add(roof);

    // Traditional Toono (roof crown ring) and chimney pipes
    const toono = new T.Mesh(new T.CylinderGeometry(0.65, 0.72, 0.22, 16), orangeCrown);
    toono.position.y = 3.82;
    ger.add(toono);

    // Woven horsehair girth bands
    for (const y of [0.35, 1.12, 1.85, 2.14]) {
      const band = new T.Mesh(new T.CylinderGeometry(3.37, 3.37, 0.065, 28, 1, true), trim);
      band.position.y = y;
      ger.add(band);
    }

    // Traditional wooden door frame with decorative panels
    const doorFrame = new T.Mesh(new T.BoxGeometry(1.06, 1.78, 0.16), trim);
    doorFrame.position.set(0, 0.9, -3.28);
    ger.add(doorFrame);
    const door = new T.Mesh(new T.BoxGeometry(0.88, 1.62, 0.18), redWood);
    door.position.set(0, 0.88, -3.3);
    ger.add(door);

    const chimney = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 1.45, 8), trim);
    chimney.position.set(0.55, 4.15, 0);
    ger.add(chimney);

    // Small nomad solar panel beside the ger
    if (scale > 0.85) {
      const panel = new T.Mesh(new T.BoxGeometry(0.95, 0.05, 0.65), solarMat);
      panel.position.set(4.3, 0.75, -1.2);
      panel.rotation.x = 0.55;
      ger.add(panel);
      const stand = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.75, 6), trim);
      stand.position.set(4.3, 0.38, -1.2);
      ger.add(stand);
    }

    ger.position.set(x, terrainSurfaceY(x, s), s);
    ger.scale.setScalar(scale);
    return ger;
  }

  makeSheep(x, s, seed) {
    const group = new T.Group();
    const wool = new T.MeshStandardMaterial({ color: 0xdad5b8, roughness: 0.96 });
    const dark = new T.MeshStandardMaterial({ color: 0x484435, roughness: 0.92 });
    const body = new T.Mesh(new T.IcosahedronGeometry(0.65, 2), wool);
    body.scale.set(1.26, 0.82, 0.78);
    body.position.y = 0.84;
    body.castShadow = true;
    group.add(body);
    const fleece = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), wool);
    fleece.position.set(0.32, 0.92, 0);
    group.add(fleece);
    const head = new T.Mesh(new T.IcosahedronGeometry(0.24, 1), dark);
    head.scale.set(1.15, 0.9, 0.85);
    head.position.set(0.74, 0.86, 0);
    group.add(head);
    for (const side of [-1, 1]) {
      const ear = new T.Mesh(new T.BoxGeometry(0.08, 0.04, 0.14), dark);
      ear.position.set(0.64, 0.92, side * 0.18);
      group.add(ear);
    }
    for (const a of [-0.4, 0.4]) for (const b of [-0.24, 0.24]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.058, 0.042, 0.62, 6), dark);
      leg.position.set(a, 0.31, b);
      group.add(leg);
    }
    group.position.set(x, terrainSurfaceY(x, s), s);
    group.rotation.y = hash(seed, 9) * 6.28;
    return group;
  }

  batchScenery(group) {
    // Bake static props by material so Ger parts, Ovoo stones, and Sheep herds share draw calls.
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), batches = new Map(), oldMaterials = new Set();
    const props = group.children.filter(o => o.isGroup && !o.userData.dynamic);
    for (const prop of props) {
      prop.traverse(mesh => {
        if (!mesh.isMesh) return;
        const material = mesh.material, key = `${material.color?.getHex() ?? 0}-${material.roughness}-${material.metalness || 0}`;
        if (!batches.has(key)) batches.set(key, { positions: [], normals: [], uvs: [], material });
        const batch = batches.get(key), g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        batch.positions.push(...g.attributes.position.array);
        batch.normals.push(...g.attributes.normal.array);
        if (g.attributes.uv) batch.uvs.push(...g.attributes.uv.array);
        else for (let j = 0; j < g.attributes.position.count; j++) batch.uvs.push(0, 0);
        g.dispose();
        mesh.geometry.dispose();
        oldMaterials.add(material);
      });
      group.remove(prop);
    }
    const retained = new Set();
    for (const batch of batches.values()) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(batch.positions, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(batch.normals, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(batch.uvs, 2));
      const mesh = new T.Mesh(geo, batch.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      retained.add(batch.material);
    }
    for (const material of oldMaterials) if (!retained.has(material)) material.dispose();
  }

  buildChunk(index) {
    const s0 = index * SIZE, group = new T.Group();
    group.position.z = s0 - this.origin;
    group.userData.s0 = s0;

    const sMid = s0 + SIZE * 0.5;
    const gobi = gobiFactor(sMid), water = waterFactor(sMid);
    const surfKind = roadSurfaceAt(sMid);
    const activeRoadMat = this.roadMats[surfKind] || this.roadMat;

    const ground = this.terrain(s0);
    ground.receiveShadow = true;
    group.add(ground);

    // Road shoulders & main 7.0m road surface (two 3.5m lanes, right-hand traffic)
    for (const [l, r, mat, y] of [
      [-6.0, -3.5, this.earthMat, -0.025],
      [3.5, 6.0, this.earthMat, -0.025],
      [-3.5, 3.5, activeRoadMat, 0.02],
    ]) {
      const geo = ribbon(s0, SIZE, l, r, 4, y);
      geo.translate(0, 0, -s0);
      const mesh = new T.Mesh(geo, mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Edge lines and dashed center line on paved & cracked asphalt sections
    if (surfKind === 'asphalt' || surfKind === 'cracked') {
      const lineStep = surfKind === 'cracked' ? 16 : 12;
      for (const [l, r] of [[-3.33, -3.24], [3.24, 3.33]]) {
        if (surfKind === 'asphalt') {
          const geo = ribbon(s0, SIZE, l, r, 4, 0.035);
          geo.translate(0, 0, -s0);
          group.add(new T.Mesh(geo, this.lineMat));
        }
      }
      for (let s = s0; s < s0 + SIZE; s += lineStep) {
        const geo = ribbon(s, 5, -0.055, 0.055, 2, 0.041);
        geo.translate(0, 0, -s0);
        group.add(new T.Mesh(geo, this.lineMat));
      }
    }

    // Lake / River water surface when in lake basin section
    if (water > 0.35) {
      const waterGeo = ribbon(s0, SIZE, 26, 360, 12, -2.4);
      waterGeo.translate(0, 0, -s0);
      const lakeMesh = new T.Mesh(waterGeo, this.waterMat);
      lakeMesh.receiveShadow = true;
      group.add(lakeMesh);
    }

    // Instanced grass tufts (denser in steppe, sparser and golden in Gobi)
    const cfg = QUALITY[this.quality];
    const grassCount = Math.max(250, Math.round(cfg.grass * (1 - gobi * 0.68)));
    const grass = new T.InstancedMesh(this.grassGeo, this.grassMat, grassCount);
    const col = new T.Color();
    for (let i = 0; i < grassCount; i++) {
      const s = s0 + hash(i, index + 19) * SIZE;
      let side = hash(i, index + 3) > 0.5 ? 1 : -1;
      let d = 6.2 + Math.pow(hash(i, index + 7), 2) * (this.quality === 'ultra' ? 88 : 65);
      if (water > 0.35 && side > 0 && d > 18) side = -1; // keep grass out of lake water
      const x = roadX(s) + side * d;
      dummy.position.set(x, terrainSurfaceY(x, s), s - s0);
      dummy.rotation.set(0, hash(i, index + 8) * 6.28, 0);
      const size = (0.5 + hash(i, index + 34) * 0.95) * (1 - gobi * 0.25);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.14 - gobi * 0.04 + hash(i, 11) * 0.08, 0.26 + hash(i, 5) * 0.14, 0.26 + gobi * 0.12 + hash(i, 13) * 0.16);
      grass.setColorAt(i, col);
    }
    grass.computeBoundingSphere();
    group.add(grass);

    // Instanced steppe / Gobi rocks
    const rockCount = Math.round(48 + gobi * 44);
    const rocks = new T.InstancedMesh(this.rockGeo, this.rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const s = s0 + hash(i + 400, index) * SIZE;
      const side = (hash(i, 53) > 0.5 && !(water > 0.35)) ? 1 : -1;
      const d = side * (6.5 + hash(i, index + 73) * 140);
      const x = roadX(s) + d;
      dummy.position.set(x, terrainSurfaceY(x, s) + 0.04, s - s0);
      dummy.rotation.set(hash(i, 5), hash(i, 6), hash(i, 7));
      const a = (0.06 + hash(i, index + 88) * 0.54) * (1 + gobi * 0.45);
      dummy.scale.set(a * 1.8, a * 0.75, a * 1.15);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.computeBoundingSphere();
    group.add(rocks);

    // Roadside utility poles & sagging wires
    const wires = [];
    for (let s = s0; s < s0 + SIZE; s += 60) {
      const x = roadX(s) + 15, y = terrainY(x, s);
      const pole = new T.Mesh(this.poleGeo, this.poleMat);
      pole.position.set(x, y + 3.9, s - s0);
      pole.castShadow = true;
      group.add(pole);
      const cross = new T.Mesh(this.crossGeo, this.poleMat);
      cross.position.set(x, y + 7.3, s - s0);
      group.add(cross);
      const next = s + 60, nx = roadX(next) + 15, ny = terrainY(nx, next);
      for (const dx of [-0.75, 0.75]) for (let j = 0; j < 8; j++) {
        for (const t of [j / 8, (j + 1) / 8]) {
          wires.push(x + (nx - x) * t + dx, y + 7.4 + (ny - y) * t - Math.sin(t * Math.PI) * 0.65, s - s0 + 60 * t);
        }
      }
    }
    const wiregeo = new T.BufferGeometry();
    wiregeo.setAttribute('position', new T.Float32BufferAttribute(wires, 3));
    group.add(new T.LineSegments(wiregeo, new T.LineBasicMaterial({ color: 0x686e59, transparent: true, opacity: 0.65 })));

    // Nomad Ger camp & Sheep flock
    if (index % 3 === 0) {
      const s = s0 + 135, x = roadX(s) - 65 - hash(index, 33) * 35;
      const ger = this.makeGer(x, s);
      ger.position.z -= s0;
      group.add(ger);
      const second = this.makeGer(x - 13, s + 10, 0.74);
      second.position.z -= s0;
      group.add(second);
      for (let i = 0; i < 9; i++) {
        const a = s + hash(i, index + 90) * 42 - 21, b = x + 15 + hash(i, index + 23) * 28;
        const sheep = this.makeSheep(b, a, index * 10 + i);
        sheep.position.z -= s0;
        group.add(sheep);
      }
    }

    // Sacred Ovoo cairn with blue khadag silk & roadside Cyrillic distance/speed signs
    if (index % 4 === 1) {
      const s = s0 + 165, x = roadX(s) - 13 - hash(index, 14) * 8;
      const ovoo = createOvoo(Math.abs(index * 17 + 3), this.batchScenery.bind(this));
      ovoo.position.set(x, terrainSurfaceY(x, s), s - s0);
      group.add(ovoo);
    }
    if (index % 2 === 0) {
      const s = s0 + 62, x = roadX(s) - 6.8;
      const sign = createRoadSign(index);
      sign.position.set(x, terrainSurfaceY(x, s), s - s0);
      sign.rotation.y = Math.atan(roadSlope(s));
      group.add(sign);
    }

    group.userData.flags = [];
    group.userData.goats = [];
    group.userData.animals = [];

    // Guaranteed Mongolian flag (with Soyombo) & Goat herd on chunk 0 and every 3rd chunk
    if (index % 3 === 0) {
      const s = s0 + 112, x = roadX(s) - 8.2;
      const flag = createFlag(this.flagTexture);
      flag.position.set(x, terrainSurfaceY(x, s), s - s0);
      group.add(flag);
      group.userData.flags.push(flag.userData.flag);

      const herdCount = this.quality === 'low' ? 5 : this.quality === 'ultra' ? 10 : 8;
      for (let i = 0; i < herdCount; i++) {
        const z = s0 + 98 + hash(i, index + 48) * 55, gx = roadX(z) - 11 - hash(i, index + 77) * 14;
        const goat = createGoat(Math.abs(index * 11 + i), this.batchScenery.bind(this), this.furTex, this.shadowMat);
        goat.position.set(gx, terrainSurfaceY(gx, z), z - s0);
        group.add(goat);
        group.userData.goats.push(goat);
      }
    }

    // Horses on the steppe & Bactrian Camels in Gobi / transition sections
    if (index % 3 === 1) {
      const count = this.quality === 'low' ? 3 : 5;
      for (let i = 0; i < count; i++) {
        const z = s0 + 70 + hash(i, index + 29) * 85;
        const hx = roadX(z) - 18 - hash(i, index + 91) * 26;
        const animal = gobi > 0.38
          ? createCamel(Math.abs(index * 13 + i), this.batchScenery.bind(this), this.furTex, this.shadowMat)
          : createHorse(Math.abs(index * 13 + i), this.batchScenery.bind(this), this.furTex, this.shadowMat);
        animal.position.set(hx, terrainSurfaceY(hx, z), z - s0);
        group.add(animal);
        group.userData.animals.push(animal);
      }
    }

    this.batchScenery(group);
    this.chunks.set(index, group);
    this.scene.add(group);
    this.stats.created++;
  }

  disposeChunk(index, group) {
    const shared = new Set([this.grassGeo, this.rockGeo, this.poleGeo, this.crossGeo]);
    const sharedMats = new Set([
      this.terrainMat, this.roadMat, this.earthMat, this.lineMat,
      this.poleMat, this.rockMat, this.grassMat, this.shadowMat, this.waterMat,
      ...Object.values(this.roadMats),
    ]);
    group.traverse(o => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.material && !sharedMats.has(o.material)) o.material.dispose();
    });
    this.scene.remove(group);
    this.chunks.delete(index);
    this.stats.disposed++;
  }

  update(s, camera, time = 0) {
    // Rebase every 2 km to keep GPU vertex precision stable on endless rides.
    const origin = Math.floor(s / 2000) * 2000;
    if (origin !== this.origin) {
      this.origin = origin;
      for (const c of this.chunks.values()) c.position.z = c.userData.s0 - origin;
    }
    const current = Math.floor(s / SIZE), cfg = QUALITY[this.quality];
    for (const [i, c] of this.chunks) if (i < current - 2 || i > current + cfg.ahead) this.disposeChunk(i, c);
    // At most one chunk per frame after initial preparation.
    for (let i = current - 2; i <= current + cfg.ahead; i++) if (!this.chunks.has(i)) {
      this.buildChunk(i);
      break;
    }

    this.sky.position.copy(camera.position);
    this.clouds.position.set(roadX(s) * 0.35, 0, s - this.origin);
    this.mountains.position.set(roadX(s), roadY(s) - 20, s - this.origin);
    this.windUniform.value = time;

    for (const chunk of this.chunks.values()) {
      for (const flag of chunk.userData.flags || []) {
        const attr = flag.geometry.attributes.position, rest = flag.userData.rest;
        for (let i = 0; i < attr.count; i++) {
          const x = rest[i * 3], y = rest[i * 3 + 1];
          attr.setZ(i, Math.sin(x * 2.7 - time * 3.3 + y * 0.8) * 0.20 * (x / 4.6) + Math.sin(x * 5 - time * 4.4) * 0.07 * (x / 4.6));
          attr.setY(i, y - Math.pow(x / 4.6, 2) * 0.16);
        }
        attr.needsUpdate = true;
        flag.geometry.computeVertexNormals();
      }
      for (const goat of chunk.userData.goats || []) {
        const phase = goat.userData.phase;
        goat.userData.head.rotation.z = -0.5 + Math.sin(time * 0.47 + phase) * 0.39;
        goat.userData.head.rotation.y = Math.sin(time * 0.37 + phase) * 0.12;
      }
      for (const animal of chunk.userData.animals || []) {
        const phase = animal.userData.phase;
        animal.userData.head.rotation.z = -0.15 + Math.sin(time * 0.38 + phase) * 0.22;
        animal.userData.head.rotation.y = Math.sin(time * 0.29 + phase) * 0.10;
      }
    }
  }

  warmup(s) {
    const c = Math.floor(s / SIZE);
    for (let i = c - 2; i <= c + QUALITY[this.quality].ahead; i++) this.buildChunk(i);
  }
}
