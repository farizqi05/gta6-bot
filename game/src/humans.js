// Cahaya Bay — detailed humans. One job: build every person in the city
// (player + pedestrians) from simple low-poly parts, so the street reads as
// people, not just cars and houses.
//
// A human is a THREE.Group, ~1.8 units tall, facing +Z at rotation 0:
//   head (sphere) + face (2 eyes, nose, mouth — small geometry, no texture,
//   so it stays readable from the chase camera and costs nothing to load)
//   + hair / hat / bandana / cap, neck, torso with shirt/jacket,
//   upper arm + forearm + hand (elbow pivots), hips,
//   thigh + shin (knee pivots) + shoe.
// Arms and legs swing from shoulder/hip pivots; animateHuman() drives them.
// Geometries and Lambert materials are cached and shared across all humans,
// so 30 pedestrians cost ~30 groups of cheap meshes, not 30 new materials.
import * as THREE from 'three';

// --- Shared geometry / material caches (perf: one of each, reused) --------
const matCache = new Map();
function mat(color) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
  return m;
}
const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `b${w},${h},${d}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
function sphGeo(r, w = 10, h = 8) {
  const k = `s${r},${w},${h}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, w, h); geoCache.set(k, g); }
  return g;
}
function cylGeo(rt, rb, h, s = 8) {
  const k = `c${rt},${rb},${h},${s}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, s); geoCache.set(k, g); }
  return g;
}
function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

// --- Small RNG shim: makeHuman works with the game's seeded RNG, or with
// no RNG at all (player mesh) by falling back to Math.random. --------------
function rngLike(rng) {
  if (rng && typeof rng.pick === 'function') return rng;
  return {
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    float: (lo, hi) => lo + Math.random() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1)),
    chance: (p) => Math.random() < p,
  };
}

export const SKIN_TONES = [0xe8b98a, 0xd8a070, 0xc98a5e, 0x8a5a3a, 0xf0c8a0];
export const HAIR_COLORS = [0x1a1210, 0x2e1a0e, 0x4a2c14, 0x6b4a2a, 0x8a8a8a];

// --- Archetypes ------------------------------------------------------------
// shirt/pants/shoes are the outfit; hair is the style; extra is the
// accessory built by addAccessory(). Height/build vary per person.
export const ARCHETYPES = {
  protagonist: {
    label: 'Protagonis',
    skin: [0xe8b98a], hair: ['short'], hairColor: [0x1a1210],
    shirt: 0x1f3a5f, shirt2: 0xe8e4da, pants: 0x2b3a4a, shoes: 0xe8e4da,
    shorts: false, sleeves: 'long', height: [0.98, 1.04], build: [1.0, 1.1],
  },
  beach: {
    label: 'Pejalan Pantai',
    skin: [0xd8a070, 0xc98a5e], hair: ['short', 'long', 'straw', 'bandana'],
    hairColor: [0x1a1210, 0x4a2c14, 0x6b4a2a],
    shirt: 0xe07856, shirt2: 0xe8b93a, pants: 0x3aa17a, shoes: 0xc98a5e,
    shorts: true, sleeves: 'short', height: [0.92, 1.02], build: [0.9, 1.1],
  },
  vendor: {
    label: 'Pedagang',
    skin: [0xd8a070, 0xc98a5e, 0x8a5a3a], hair: ['straw', 'cap', 'short'],
    hairColor: [0x1a1210, 0x2e1a0e, 0x8a8a8a],
    shirt: 0x2e6fb0, shirt2: 0xe8e4da, pants: 0x5a4632, shoes: 0x3a2a1a,
    shorts: false, sleeves: 'short', height: [0.92, 1.0], build: [1.0, 1.2],
  },
  office: {
    label: 'Pekerja Kantoran',
    skin: [0xe8b98a, 0xf0c8a0, 0xd8a070], hair: ['short', 'bun'],
    hairColor: [0x1a1210, 0x2e1a0e, 0x4a2c14],
    shirt: 0x2c2f36, shirt2: 0xe8e4da, pants: 0x22262b, shoes: 0x14161a,
    shorts: false, sleeves: 'long', height: [0.96, 1.06], build: [0.9, 1.05],
  },
  skater: {
    label: 'Skater / Anak Muda',
    skin: [0xe8b98a, 0xd8a070, 0xf0c8a0], hair: ['beanie', 'cap', 'short'],
    hairColor: [0x1a1210, 0x2e1a0e, 0x6b4a2a, 0x8a8a8a],
    shirt: 0xd94f3d, shirt2: 0xe8b93a, pants: 0x3a4a5a, shoes: 0xe8e4da,
    shorts: false, sleeves: 'long', height: [0.9, 1.0], build: [0.85, 1.0],
  },
  police: {
    label: 'Polisi Jalan Kaki',
    skin: [0xe8b98a, 0xd8a070, 0xc98a5e], hair: ['policeCap'],
    hairColor: [0x1a1210],
    shirt: 0x1f3a5f, shirt2: 0x1f3a5f, pants: 0x1f3a5f, shoes: 0x14161a,
    shorts: false, sleeves: 'long', height: [0.98, 1.06], build: [1.05, 1.15],
  },
};
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

// --- Hair / headwear -------------------------------------------------------
function addHair(head, style, hairColor, rng) {
  const dark = 0x14161a;
  if (style === 'short') {
    const h = mesh(sphGeo(0.22), hairColor, 0, 0.07, -0.02);
    h.scale.set(1, 0.72, 1); head.add(h);
  } else if (style === 'long') {
    const h = mesh(sphGeo(0.22), hairColor, 0, 0.07, -0.02);
    h.scale.set(1, 0.72, 1); head.add(h);
    head.add(mesh(boxGeo(0.34, 0.46, 0.09), hairColor, 0, -0.16, -0.19));
  } else if (style === 'bun') {
    const h = mesh(sphGeo(0.22), hairColor, 0, 0.07, -0.02);
    h.scale.set(1, 0.72, 1); head.add(h);
    head.add(mesh(sphGeo(0.09), hairColor, 0, 0.24, -0.08));
  } else if (style === 'cap') {
    head.add(mesh(cylGeo(0.225, 0.225, 0.09, 10), rng.pick([0xd94f3d, 0x2e6fb0, 0xe8b93a, 0x3aa17a]), 0, 0.14, 0));
    head.add(mesh(boxGeo(0.3, 0.03, 0.2), dark, 0, 0.1, 0.24));
  } else if (style === 'beanie') {
    const h = mesh(sphGeo(0.23), rng.pick([0xd94f3d, 0x2e6fb0, 0x8a5fb0, 0x22262b]), 0, 0.1, -0.01);
    h.scale.set(1, 0.68, 1); head.add(h);
    head.add(mesh(cylGeo(0.23, 0.23, 0.07, 10), 0xe8e4da, 0, 0.03, 0));
  } else if (style === 'straw') {
    head.add(mesh(cylGeo(0.33, 0.33, 0.03, 12), 0xe8c98a, 0, 0.16, 0));
    head.add(mesh(cylGeo(0.13, 0.16, 0.1, 10), 0xd8b878, 0, 0.22, 0));
  } else if (style === 'bandana') {
    head.add(mesh(cylGeo(0.22, 0.22, 0.09, 10), rng.pick([0xd94f3d, 0x2e6fb0, 0xe8b93a]), 0, 0.12, 0));
    head.add(mesh(boxGeo(0.1, 0.16, 0.05), rng.pick([0xd94f3d, 0x2e6fb0]), 0, 0.06, -0.22));
    const h = mesh(sphGeo(0.21), hairColor, 0, 0.05, -0.03);
    h.scale.set(1, 0.6, 1); head.add(h);
  } else if (style === 'policeCap') {
    head.add(mesh(cylGeo(0.225, 0.225, 0.1, 10), 0x1f3a5f, 0, 0.14, 0));
    head.add(mesh(boxGeo(0.28, 0.03, 0.16), dark, 0, 0.1, 0.24));
    head.add(mesh(boxGeo(0.07, 0.05, 0.02), 0xe8b93a, 0, 0.14, 0.22));
  }
  return head;
}

function addSunglasses(head) {
  head.add(mesh(boxGeo(0.3, 0.06, 0.03), 0x14161a, 0, 0.02, 0.2));
}

// --- Accessories (attached to the body group, so they bob with the walk) ---
function addAccessory(body, archetype, def, rng, rig) {
  if (archetype === 'protagonist') {
    // Open jacket over a white tee + sunglasses.
    body.add(mesh(boxGeo(0.3, 0.46, 0.02), def.shirt2, 0, 1.22, 0.16));
    addSunglasses(rig.head);
  } else if (archetype === 'beach') {
    if (rng.chance(0.5)) addSunglasses(rig.head);
    // Bright chest stripe on the Hawaiian shirt.
    body.add(mesh(boxGeo(0.54, 0.1, 0.02), def.shirt2, 0, 1.34, 0.16));
  } else if (archetype === 'vendor') {
    // White apron + woven basket on the back.
    body.add(mesh(boxGeo(0.4, 0.5, 0.02), 0xe8e4da, 0, 1.14, 0.17));
    body.add(mesh(boxGeo(0.36, 0.24, 0.14), 0x8a6b48, 0, 1.26, -0.23));
  } else if (archetype === 'office') {
    // Tie + briefcase in the right hand (swings with the arm).
    body.add(mesh(boxGeo(0.08, 0.38, 0.02), 0xd94f3d, 0, 1.26, 0.16));
    const bc = mesh(boxGeo(0.34, 0.24, 0.09), 0x5a4632, 0, -0.44, 0.02);
    rig.elbowR.add(bc);
  } else if (archetype === 'skater') {
    // Backpack + cap worn backwards (brim at the back).
    body.add(mesh(boxGeo(0.36, 0.44, 0.14), rng.pick([0x2e6fb0, 0x8a5fb0, 0x3aa17a]), 0, 1.26, -0.23));
    const cap = rig.head.children.find((c) => c.position.z > 0.2 && c.position.y > 0.05);
    if (cap) cap.position.z = -0.24;
  } else if (archetype === 'police') {
    // Belt, gold badge, shoulder radio.
    body.add(mesh(boxGeo(0.52, 0.06, 0.32), 0x14161a, 0, 1.0, 0));
    body.add(mesh(boxGeo(0.07, 0.07, 0.02), 0xe8b93a, -0.14, 1.38, 0.16));
    body.add(mesh(boxGeo(0.08, 0.12, 0.06), 0x14161a, -0.28, 1.44, 0.06));
  }
}

// --- Build one human -------------------------------------------------------
export function makeHuman(rng, archetype = 'random') {
  const R = rngLike(rng);
  const name = archetype === 'random' || !ARCHETYPES[archetype]
    ? R.pick(ARCHETYPE_NAMES) : archetype;
  const def = ARCHETYPES[name];
  const skin = R.pick(def.skin);
  const hairColor = R.pick(def.hairColor);
  const hairStyle = R.pick(def.hair);
  const shirt = name === 'protagonist' || name === 'office' || name === 'police'
    ? def.shirt : R.pick([def.shirt, def.shirt2, 0x2e6fb0, 0xd94f3d, 0xe8b93a, 0x3aa17a]);
  const scale = R.float(def.height[0], def.height[1]);
  const build = R.float(def.build[0], def.build[1]);
  const shortSleeve = def.sleeves === 'short';
  const forearmColor = shortSleeve ? skin : shirt;
  const thighColor = def.shorts ? def.pants : def.pants;
  const shinColor = def.shorts ? skin : def.pants;

  const g = new THREE.Group();
  const body = new THREE.Group(); // torso+head+arms: bobs while walking
  g.add(body);

  // Hips + torso.
  body.add(mesh(boxGeo(0.5, 0.18, 0.28), def.pants, 0, 0.98, 0));
  const torso = mesh(boxGeo(0.54, 0.58, 0.3), shirt, 0, 1.22, 0);
  torso.scale.x = build;
  body.add(torso);
  // Collar / shoulder pads: a thin slab so the torso reads as a jacket.
  body.add(mesh(boxGeo(0.56, 0.08, 0.32), shirt, 0, 1.5, 0));

  // Neck + head + face.
  body.add(mesh(cylGeo(0.07, 0.08, 0.1, 8), skin, 0, 1.56, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.74, 0);
  body.add(head);
  head.add(mesh(sphGeo(0.21), skin, 0, 0, 0));
  // Face: eyes, nose, mouth — small geometry on the +Z (forward) side.
  head.add(mesh(sphGeo(0.028, 6, 5), 0x14161a, -0.075, 0.02, 0.185));
  head.add(mesh(sphGeo(0.028, 6, 5), 0x14161a, 0.075, 0.02, 0.185));
  head.add(mesh(boxGeo(0.05, 0.08, 0.04), skin, 0, -0.03, 0.2));
  head.add(mesh(boxGeo(0.1, 0.015, 0.02), 0x8a3a2a, 0, -0.1, 0.195));
  addHair(head, hairStyle, hairColor, R);

  // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand.
  function makeArm(side) { // side: -1 left, +1 right
    const shoulder = new THREE.Group();
    shoulder.position.set(0.32 * side * build, 1.48, 0);
    body.add(shoulder);
    shoulder.add(mesh(boxGeo(0.13, 0.32, 0.14), shirt, 0, -0.16, 0));
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.32, 0);
    shoulder.add(elbow);
    elbow.add(mesh(boxGeo(0.11, 0.3, 0.12), forearmColor, 0, -0.15, 0));
    elbow.add(mesh(boxGeo(0.11, 0.12, 0.06), skin, 0, -0.35, 0));
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Legs: hip pivot -> thigh -> knee pivot -> shin + shoe.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, 0.92, 0);
    g.add(hip);
    hip.add(mesh(boxGeo(0.17, 0.42, 0.19), thighColor, 0, -0.21, 0));
    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);
    knee.add(mesh(boxGeo(0.15, 0.4, 0.16), shinColor, 0, -0.2, 0));
    knee.add(mesh(boxGeo(0.17, 0.09, 0.3), def.shoes, 0, -0.43, 0.05));
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const rig = {
    body, head,
    armL: armL.shoulder, armR: armR.shoulder,
    elbowL: armL.elbow, elbowR: armR.elbow,
    legL: legL.hip, legR: legR.hip,
    kneeL: legL.knee, kneeR: legR.knee,
  };
  addAccessory(body, name, def, R, rig);

  g.scale.setScalar(scale);
  g.userData.rig = rig;
  // Back-compat: player.js used userData.legs = [legL, legR] (hip pivots).
  g.userData.legs = [legL.hip, legR.hip];
  g.userData.arms = [armL.shoulder, armR.shoulder];
  g.userData.walkPhase = R.float(0, Math.PI * 2);
  g.userData.amp = 0;
  g.userData.archetype = name;
  return g;
}

// --- Walk / run animation --------------------------------------------------
// mesh: a group from makeHuman. dt: seconds. speed: m/s (0 = idle).
// Arms and legs swing opposite each other; knees bend on the back-swing;
// the body bobs and leans slightly forward when running. Fleeing peds pass
// speed ~5, so they automatically swing faster and wider.
export function animateHuman(mesh, dt, speed) {
  const u = mesh.userData;
  const rig = u.rig;
  if (!rig) return;
  const moving = speed > 0.15;
  const targetAmp = moving ? (speed > 4 ? 0.85 : 0.6) : 0;
  u.amp += (targetAmp - (u.amp || 0)) * Math.min(1, dt * 8);
  if (moving) u.walkPhase = (u.walkPhase || 0) + dt * speed * 1.7;
  const ph = u.walkPhase || 0;
  const amp = u.amp || 0;
  const s = Math.sin(ph);
  rig.legL.rotation.x = s * amp;
  rig.legR.rotation.x = -s * amp;
  // Knee bends when its leg swings back.
  rig.kneeL.rotation.x = Math.max(0, -s) * 0.55 * amp;
  rig.kneeR.rotation.x = Math.max(0, s) * 0.55 * amp;
  rig.armL.rotation.x = -s * amp * 0.8;
  rig.armR.rotation.x = s * amp * 0.8;
  // Elbows stay slightly bent, more when running.
  rig.elbowL.rotation.x = -0.2 * amp - (speed > 4 ? 0.35 : 0);
  rig.elbowR.rotation.x = -0.2 * amp - (speed > 4 ? 0.35 : 0);
  // Bob + forward lean.
  rig.body.position.y = Math.abs(Math.cos(ph)) * 0.045 * amp;
  rig.body.rotation.x = speed > 4 ? 0.12 : 0.03 * amp;
}
