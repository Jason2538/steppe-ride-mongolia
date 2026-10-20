import * as T from './vendor/three.module.js';

// Original expedition wagon, metres, forward +Z. No third-party model assets.
export function createCar() {
  const root = new T.Group(), body = new T.Group(), cabin = new T.Group();
  root.add(body);
  body.add(cabin);

  // Clearcoat metallic paint and physically based glass/metal for Ultra quality reflection
  const paint = new T.MeshPhysicalMaterial({ color: 0x6f8669, metalness: 0.52, roughness: 0.24, clearcoat: 0.92, clearcoatRoughness: 0.12 });
  const trim = new T.MeshStandardMaterial({ color: 0x222926, roughness: 0.72, metalness: 0.18 });
  const rubber = new T.MeshStandardMaterial({ color: 0x171b19, roughness: 0.94, metalness: 0.04 });
  const silver = new T.MeshStandardMaterial({ color: 0xb4beb9, metalness: 0.85, roughness: 0.20 });
  const glass = new T.MeshPhysicalMaterial({ color: 0x688c89, metalness: 0.25, roughness: 0.08, transparent: true, opacity: 0.38, clearcoat: 1.0, depthWrite: false });
  const seat = new T.MeshStandardMaterial({ color: 0x2d3631, roughness: 0.92 });
  const lamp = new T.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffdc92, emissiveIntensity: 0.9, roughness: 0.18 });
  const tail = new T.MeshStandardMaterial({ color: 0xd8442c, emissive: 0xb52418, emissiveIntensity: 0.55, roughness: 0.25 });
  const jerryMat = new T.MeshStandardMaterial({ color: 0x9b4629, roughness: 0.55, metalness: 0.25 });

  function box(w, h, d, x, y, z, mat, parent = body, r = 0.035) {
    r = Math.min(r, w / 4, h / 4, d / 4);
    const shape = new T.Shape(), a = -w / 2, b = -h / 2;
    shape.moveTo(a + r, b);
    shape.lineTo(a + w - r, b);
    shape.quadraticCurveTo(a + w, b, a + w, b + r);
    shape.lineTo(a + w, b + h - r);
    shape.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    shape.lineTo(a + r, b + h);
    shape.quadraticCurveTo(a, b + h, a, b + h - r);
    shape.lineTo(a, b + r);
    shape.quadraticCurveTo(a, b, a + r, b);
    const g = new T.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.45, bevelSegments: 2, curveSegments: 4, steps: 1 });
    g.translate(0, 0, -d / 2 + r);
    g.computeVertexNormals();
    const m = new T.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Main body shell, lower protective cladding, sculpted hood & roof
  box(1.82, 0.49, 4.25, 0, 0.8, 0, paint, body, 0.08);
  box(1.88, 0.22, 4.35, 0, 0.48, 0, trim);
  box(1.7, 0.12, 1.18, 0, 1.08, 1.43, paint, body, 0.045);
  box(1.68, 0.12, 2.53, 0, 1.83, -0.38, paint, cabin, 0.04);
  box(1.65, 0.63, 0.025, 0, 1.47, 0.81, glass, cabin);
  box(1.64, 0.56, 0.025, 0, 1.47, -1.64, glass, cabin);

  // Side windows, pillars, door handles, mirrors, roof rails, rock sliders & wheel arch flares
  for (const side of [-1, 1]) {
    box(0.03, 0.58, 2.3, side * 0.85, 1.48, -0.4, glass, cabin);
    for (const z of [0.82, -0.3, -1.65]) box(0.075, 0.73, 0.075, side * 0.855, 1.46, z, paint, cabin);
    box(0.045, 0.07, 2.48, side * 0.86, 1.16, -0.4, paint);
    box(0.05, 0.018, 2.43, side * 0.88, 1.12, -0.4, silver);
    for (const z of [0.18, -0.96]) {
      box(0.025, 0.39, 0.017, side * 0.925, 0.88, z - 0.49, trim);
      box(0.035, 0.043, 0.17, side * 0.934, 1.055, z - 0.2, silver);
    }
    box(0.2, 0.15, 0.29, side * 1.01, 1.32, 0.69, trim, cabin);
    box(0.013, 0.11, 0.22, side * 1.117, 1.33, 0.67, silver, cabin);
    box(0.36, 0.17, 0.04, side * 0.59, 0.92, 2.16, lamp);
    box(0.22, 0.31, 0.04, side * 0.72, 0.88, -2.16, tail);
    box(0.08, 0.055, 2.28, side * 0.61, 1.95, -0.36, trim, cabin);
    box(0.14, 0.07, 3.0, side * 0.92, 0.4, -0.05, silver);
    // Fender arch flares & suspension coil springs visible inside wheel wells
    for (const z of [-1.33, 1.34]) {
      box(0.12, 0.14, 0.82, side * 0.91, 0.72, z, trim);
      const strut = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.38, 10), silver);
      strut.position.set(side * 0.68, 0.62, z);
      body.add(strut);
    }
  }

  // Front grille, bullbar, skid plate, bumpers & windshield wipers
  box(0.83, 0.24, 0.045, 0, 0.87, 2.17, trim);
  for (let i = 0; i < 6; i++) box(0.035, 0.17, 0.035, (i - 2.5) * 0.12, 0.88, 2.2, silver);
  box(1.84, 0.12, 0.12, 0, 0.56, 2.22, silver);
  box(1.84, 0.12, 0.12, 0, 0.56, -2.22, silver);
  box(0.95, 0.24, 0.08, 0, 0.68, 2.28, trim);
  box(0.43, 0.12, 0.018, 0, 0.78, -2.16, silver);
  for (const x of [-0.32, 0.28]) {
    box(0.42, 0.02, 0.02, x, 1.16, 0.84, trim, cabin);
  }

  // Rear-mounted full-size spare wheel on tailgate
  const spareGroup = new T.Group();
  spareGroup.position.set(-0.32, 0.98, -2.24);
  body.add(spareGroup);
  const spareTire = new T.Mesh(new T.TorusGeometry(0.28, 0.105, 14, 32), rubber);
  spareTire.castShadow = true;
  spareGroup.add(spareTire);
  const spareRim = new T.Mesh(new T.CylinderGeometry(0.21, 0.21, 0.14, 20), silver);
  spareRim.rotation.x = Math.PI / 2;
  spareGroup.add(spareRim);

  // Seats, dashboard, console, and steering wheel remain visible in the cabin view without blocking road sightlines
  for (const x of [-0.43, 0.43]) {
    box(0.55, 0.18, 0.6, x, 0.82, -0.21, seat);
    const back = box(0.54, 0.59, 0.16, x, 1.1, -0.52, seat);
    back.rotation.x = 0.1;
    box(0.32, 0.19, 0.13, x, 1.49, -0.57, seat);
  }
  box(1.5, 0.26, 0.42, 0, 1.04, 0.51, trim);
  box(0.29, 0.25, 0.85, 0, 0.85, 0.05, trim);
  box(0.29, 0.16, 0.025, 0, 1.17, 0.275, new T.MeshStandardMaterial({ color: 0x0f262b, emissive: 0x203c3b, emissiveIntensity: 0.6 }));

  const steering = new T.Group();
  steering.position.set(0.43, 1.12, 0.6);
  steering.rotation.x = -0.35;
  body.add(steering);
  const ring = new T.Mesh(new T.TorusGeometry(0.17, 0.018, 10, 32), trim);
  steering.add(ring);
  box(0.3, 0.026, 0.028, 0, 0, 0, silver, steering);
  box(0.065, 0.17, 0.035, 0, -0.07, 0, trim, steering);
  box(0.49, 0.18, 0.11, 0.43, 1.19, 0.81, trim);

  const dialMat = new T.MeshStandardMaterial({ color: 0xe1e8d3, emissive: 0x405b43, emissiveIntensity: 0.45, side: T.DoubleSide });
  for (const x of [0.31, 0.55]) {
    const dial = new T.Mesh(new T.CircleGeometry(0.064, 24), dialMat);
    dial.position.set(x, 1.2, 0.745);
    body.add(dial);
    const needle = box(0.005, 0.048, 0.005, x, 1.21, 0.738, tail);
    needle.rotation.z = 0.6;
  }

  // Detailed off-road wheels with tread blocks, alloy spokes, and brake discs
  const wheels = [], frontPivots = [];
  const tireGeo = new T.CylinderGeometry(0.4, 0.4, 0.24, 36);
  const rimGeo = new T.CylinderGeometry(0.25, 0.25, 0.255, 24);
  const discGeo = new T.CylinderGeometry(0.18, 0.18, 0.04, 20);
  tireGeo.rotateZ(Math.PI / 2);
  rimGeo.rotateZ(Math.PI / 2);
  discGeo.rotateZ(Math.PI / 2);

  for (const x of [-0.86, 0.86]) for (const z of [-1.33, 1.34]) {
    const pivot = new T.Group();
    pivot.position.set(x, 0.4, z);
    body.add(pivot);
    if (z > 0) frontPivots.push(pivot);
    const wheel = new T.Group();
    pivot.add(wheel);
    wheels.push(wheel);
    for (const [geo, mat] of [[tireGeo, rubber], [rimGeo, silver], [discGeo, trim]]) {
      const mesh = new T.Mesh(geo, mat);
      mesh.castShadow = true;
      wheel.add(mesh);
    }
    for (let i = 0; i < 6; i++) {
      const spoke = box(0.265, 0.038, 0.43, 0, 0, 0, trim, wheel, 0.006);
      spoke.rotation.x = i * Math.PI / 3;
    }
  }

  // Expedition roof rack, cargo case, rolled tarp, and side fuel jerrycan
  for (const z of [-1.2, 0.35]) box(1.48, 0.065, 0.07, 0, 1.99, z, silver, cabin);
  box(0.86, 0.22, 1.24, -0.14, 2.12, -0.47, trim, cabin, 0.06);
  for (const x of [-0.36, 0.08]) box(0.035, 0.225, 1.25, x, 2.12, -0.47, silver, cabin);
  box(0.32, 0.24, 0.46, 0.48, 2.13, -0.62, jerryMat, cabin, 0.03);

  return { root, body, cabin, wheels, frontPivots, steering, tail };
}
