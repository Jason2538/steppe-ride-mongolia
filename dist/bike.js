import * as T from './vendor/three.module.js';

export function createBike() {
  const root = new T.Group(), body = new T.Group();
  root.add(body);

  // Physically based materials for realistic reflections under HDR environment lighting
  const mat = {
    black:  new T.MeshStandardMaterial({ color: 0x1e2420, roughness: 0.58, metalness: 0.25 }),
    tire:   new T.MeshStandardMaterial({ color: 0x161b18, roughness: 0.92, metalness: 0.04 }),
    silver: new T.MeshStandardMaterial({ color: 0xaab6ae, metalness: 0.86, roughness: 0.22 }),
    gold:   new T.MeshStandardMaterial({ color: 0xc8a355, metalness: 0.78, roughness: 0.26 }),
    paint:  new T.MeshPhysicalMaterial({ color: 0xb99d58, metalness: 0.42, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.14 }),
    seat:   new T.MeshStandardMaterial({ color: 0x2c3029, roughness: 0.88 }),
    cloth:  new T.MeshStandardMaterial({ color: 0x4e5c48, roughness: 0.92 }),
    helmet: new T.MeshPhysicalMaterial({ color: 0xe3dbc0, roughness: 0.25, metalness: 0.12, clearcoat: 0.9 }),
    visor:  new T.MeshPhysicalMaterial({ color: 0x1b3032, metalness: 0.65, roughness: 0.12, clearcoat: 1.0 }),
    red:    new T.MeshStandardMaterial({ color: 0xd64828, emissive: 0x9c2212, emissiveIntensity: 0.65, roughness: 0.3 }),
    lamp:   new T.MeshStandardMaterial({ color: 0xfff3cc, emissive: 0xffdc92, emissiveIntensity: 0.75, roughness: 0.2 }),
  };

  function beveled(w, h, d) {
    const r = Math.min(w, h, d) * 0.16, s = new T.Shape(), a = -w / 2, b = -h / 2;
    s.moveTo(a + r, b);
    s.lineTo(a + w - r, b);
    s.quadraticCurveTo(a + w, b, a + w, b + r);
    s.lineTo(a + w, b + h - r);
    s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    s.lineTo(a + r, b + h);
    s.quadraticCurveTo(a, b + h, a, b + h - r);
    s.lineTo(a, b + r);
    s.quadraticCurveTo(a, b, a + r, b);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelSize: r * 0.5, bevelThickness: r, bevelSegments: 2, curveSegments: 4, steps: 1 });
    g.translate(0, 0, -d / 2 + r);
    g.computeVertexNormals();
    return g;
  }

  function box(w, h, d, x, y, z, m, parent = body) {
    const a = new T.Mesh(h > 0.06 && w > 0.08 && d > 0.07 ? beveled(w, h, d) : new T.BoxGeometry(w, h, d), m);
    a.position.set(x, y, z);
    a.castShadow = true;
    a.receiveShadow = true;
    parent.add(a);
    return a;
  }
  function sphere(r, x, y, z, m, sx = 1, sy = 1, sz = 1, parent = body) {
    const a = new T.Mesh(new T.SphereGeometry(r, 28, 18), m);
    a.position.set(x, y, z);
    a.scale.set(sx, sy, sz);
    a.castShadow = true;
    a.receiveShadow = true;
    parent.add(a);
    return a;
  }
  function bar(a, b, r, m, parent = body) {
    const va = new T.Vector3(...a), vb = new T.Vector3(...b), v = vb.clone().sub(va);
    const mesh = new T.Mesh(new T.CylinderGeometry(r, r, v.length(), 10), m);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const wheels = [];
  for (const z of [-0.77, 0.85]) {
    const wheel = new T.Group();
    wheel.position.set(0, 0.36, z);
    body.add(wheel);
    wheels.push(wheel);
    const tire = new T.Mesh(new T.TorusGeometry(0.285, 0.09, 14, 48), mat.tire);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const tread = new T.InstancedMesh(new T.BoxGeometry(0.125, 0.014, 0.048), mat.tire, 36), dummy = new T.Object3D();
    for (let j = 0; j < 36; j++) {
      const angle = j / 36 * Math.PI * 2;
      dummy.position.set(0, Math.cos(angle) * 0.374, Math.sin(angle) * 0.374);
      dummy.rotation.x = angle;
      dummy.updateMatrix();
      tread.setMatrixAt(j, dummy.matrix);
    }
    wheel.add(tread);
    const rim = new T.Mesh(new T.TorusGeometry(0.235, 0.022, 6, 28), mat.silver);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    const hub = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.16, 14), mat.silver);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      bar([0, 0, 0], [0, Math.sin(a) * 0.24, Math.cos(a) * 0.24], 0.0075, mat.silver, wheel);
    }
    const disc = new T.Mesh(new T.CylinderGeometry(0.145, 0.145, 0.012, 24), mat.silver);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.082;
    wheel.add(disc);
    const caliper = box(0.045, 0.065, 0.075, 0.09, 0.09, -0.08, mat.gold, wheel);
    caliper.castShadow = false;
  }

  // Tubular trellis frame, swingarm, inverted front forks
  for (const side of [-1, 1]) {
    bar([side * 0.14, 0.39, -0.77], [side * 0.14, 0.79, 0.1], 0.035, mat.black);
    bar([side * 0.14, 0.79, 0.1], [side * 0.14, 0.45, 0.5], 0.035, mat.black);
    bar([side * 0.14, 0.45, 0.5], [side * 0.14, 0.39, -0.77], 0.03, mat.black);
    // Gold anodized upper fork tubes & silver lower sliders
    bar([side * 0.13, 0.37, 0.85], [side * 0.13, 0.74, 0.73], 0.028, mat.silver);
    bar([side * 0.13, 0.74, 0.73], [side * 0.13, 1.12, 0.61], 0.036, mat.gold);
    bar([side * 0.16, 0.7, -0.55], [side * 0.16, 0.96, -0.3], 0.03, mat.silver);
    // Engine crash bars
    bar([side * 0.15, 0.52, 0.38], [side * 0.26, 0.68, 0.26], 0.018, mat.black);
    bar([side * 0.26, 0.68, 0.26], [side * 0.16, 0.78, 0.12], 0.018, mat.black);
  }

  // Engine block, cooling fins, exhaust header & brushed muffler
  sphere(0.25, 0, 0.62, 0.02, mat.silver, 1, 0.9, 1.1);
  for (let y = 0.51; y < 0.76; y += 0.045) box(0.44, 0.014, 0.27, 0, y, 0.12, mat.black);
  bar([0.16, 0.58, 0.28], [0.22, 0.46, -0.15], 0.032, mat.silver);
  bar([0.22, 0.46, -0.15], [0.26, 0.44, -0.6], 0.038, mat.silver);
  box(0.15, 0.15, 0.58, 0.28, 0.48, -0.52, mat.silver);

  const tank = sphere(0.31, 0, 1.0, 0.22, mat.paint, 0.81, 0.69, 1.42);
  tank.rotation.x = -0.12;
  box(0.38, 0.11, 0.64, 0, 0.99, -0.32, mat.seat);
  box(0.42, 0.08, 0.35, 0, 0.94, -0.72, mat.paint);
  box(0.36, 0.08, 0.38, 0, 0.77, 0.86, mat.paint);
  box(0.32, 0.15, 0.08, 0, 0.93, -0.9, mat.red);
  box(0.27, 0.19, 0.04, 0, 0.77, -0.95, mat.helmet);
  box(0.39, 0.25, 0.15, 0, 1.1, 0.72, mat.black);
  box(0.25, 0.16, 0.025, 0, 1.11, 0.808, mat.lamp);

  // Adventure windscreen and digital instrument cluster
  const glass = new T.Mesh(
    new T.BoxGeometry(0.39, 0.33, 0.024),
    new T.MeshPhysicalMaterial({ color: 0xb8d0c5, transparent: true, opacity: 0.36, roughness: 0.14, metalness: 0.1, clearcoat: 1.0 })
  );
  glass.position.set(0, 1.35, 0.66);
  glass.rotation.x = 0.22;
  body.add(glass);

  const dash = new T.Mesh(
    new T.BoxGeometry(0.16, 0.09, 0.025),
    new T.MeshStandardMaterial({ color: 0x152b2e, emissive: 0x26544e, emissiveIntensity: 0.55, roughness: 0.3 })
  );
  dash.position.set(0, 1.24, 0.61);
  dash.rotation.x = -0.25;
  body.add(dash);

  const handle = new T.Group();
  handle.position.set(0, 1.2, 0.52);
  body.add(handle);
  bar([-0.42, 0, -0.08], [0.42, 0, -0.08], 0.022, mat.silver, handle);
  for (const side of [-1, 1]) {
    bar([side * 0.29, 0, -0.08], [side * 0.45, 0, -0.1], 0.035, mat.black, handle);
    bar([side * 0.32, 0, -0.08], [side * 0.43, 0.24, 0.04], 0.012, mat.silver, handle);
    sphere(0.075, side * 0.43, 0.27, 0.04, mat.black, 1.4, 0.65, 0.4, handle);
    // Handguards & brake/clutch levers
    box(0.13, 0.055, 0.04, side * 0.38, 0.01, -0.03, mat.black, handle);
  }

  const rider = new T.Group();
  body.add(rider);
  const torso = sphere(0.3, 0, 1.43, -0.19, mat.cloth, 0.81, 1.38, 0.66, rider);
  torso.rotation.x = 0.24;
  sphere(0.13, 0, 1.16, -0.34, mat.black, 1.25, 1, 1.5, rider);
  sphere(0.205, 0, 1.97, -0.035, mat.helmet, 0.93, 1.08, 1, rider);
  sphere(0.18, 0, 1.99, 0.08, mat.visor, 0.9, 0.6, 0.65, rider);
  const helmetRim = new T.Mesh(new T.TorusGeometry(0.177, 0.013, 6, 30), mat.black);
  helmetRim.rotation.x = Math.PI / 2;
  helmetRim.position.set(0, 1.86, -0.02);
  rider.add(helmetRim);
  box(0.17, 0.055, 0.12, 0, 2.175, -0.03, mat.black, rider);
  box(0.12, 0.07, 0.025, 0, 1.99, -0.224, mat.red, rider);

  for (const side of [-1, 1]) {
    bar([side * 0.2, 1.65, -0.14], [side * 0.31, 1.38, 0.1], 0.085, mat.cloth, rider);
    bar([side * 0.31, 1.38, 0.1], [side * 0.4, 1.22, 0.44], 0.065, mat.cloth, rider);
    sphere(0.066, side * 0.4, 1.22, 0.44, mat.black, 1, 1, 1, rider);
    bar([side * 0.13, 1.15, -0.28], [side * 0.29, 0.86, 0.17], 0.1, mat.black, rider);
    bar([side * 0.29, 0.86, 0.17], [side * 0.26, 0.43, -0.12], 0.078, mat.black, rider);
    box(0.15, 0.12, 0.29, side * 0.26, 0.4, -0.04, mat.black, rider);
    // Side adventure pannier cases
    box(0.33, 0.38, 0.48, side * 0.39, 0.84, -0.65, mat.cloth);
    box(0.35, 0.045, 0.49, side * 0.39, 1.05, -0.65, mat.black);
  }
  box(0.29, 0.38, 0.12, 0, 1.52, -0.43, mat.black, rider);
  const stitch = new T.MeshStandardMaterial({ color: 0xbab49b, roughness: 0.95 });
  for (const side of [-1, 1]) {
    bar([side * 0.095, 1.69, -0.51], [side * 0.095, 1.36, -0.51], 0.009, stitch, rider);
    box(0.07, 0.04, 0.02, side * 0.095, 1.39, -0.51, mat.silver, rider);
    sphere(0.055, side * 0.21, 1.67, -0.16, mat.black, 1.3, 0.7, 1, rider);
    box(0.035, 0.20, 0.025, side * 0.46, 0.85, -0.902, stitch);
  }

  // Suspension coils, luggage latches, rear rack and rolled bedroll
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const coil = new T.Mesh(new T.TorusGeometry(0.05, 0.009, 5, 12), mat.silver);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(side * 0.16, 0.73 + i * 0.023, -0.48 + i * 0.017);
      body.add(coil);
    }
    box(0.055, 0.035, 0.03, side * 0.4, 1.09, -0.85, mat.silver);
  }
  bar([-0.28, 1.09, -0.74], [0.28, 1.09, -0.74], 0.016, mat.silver);
  bar([-0.28, 1.09, -0.9], [0.28, 1.09, -0.9], 0.016, mat.silver);
  const rollBag = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.46, 14), mat.paint);
  rollBag.rotation.z = Math.PI / 2;
  rollBag.position.set(0, 1.19, -0.82);
  rollBag.castShadow = true;
  body.add(rollBag);

  return { root, body, rider, wheels, handle, mat };
}
