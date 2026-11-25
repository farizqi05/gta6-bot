// Cahaya Bay — the city. One job: build the visible world (ground, roads,
// buildings, palms, beach, sea) and answer collision questions about it.
import * as THREE from 'three';
import { CFG } from './config.js';

const WORLD = 280; // ground plane size; world coords run -140..140

function worldToCanvas(v) { return ((v + WORLD / 2) / WORLD) * 1024; }

// Paint the whole ground in one canvas texture: sand, sea, concrete, asphalt
// roads with lane dashes, sidewalks and crosswalks. One texture, one draw.
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const to = worldToCanvas;
  // Base: warm concrete.
  g.fillStyle = '#d8cbb0'; g.fillRect(0, 0, 1024, 1024);
  // Sea (south) and beach.
  g.fillStyle = '#2e7f9e'; g.fillRect(0, to(CFG.seaZ), 1024, 1024 - to(CFG.seaZ));
  g.fillStyle = '#e8c98a'; g.fillRect(0, to(CFG.beachZ), 1024, to(CFG.seaZ) - to(CFG.beachZ));
  // City blocks: sidewalk slabs.
  const R = CFG.roads;
  for (let i = 0; i < R.length - 1; i++) {
    for (let j = 0; j < R.length - 1; j++) {
      const x0 = R[i] + CFG.streetWidth / 2, x1 = R[i + 1] - CFG.streetWidth / 2;
      const z0 = R[j] + CFG.streetWidth / 2, z1 = R[j + 1] - CFG.streetWidth / 2;
      g.fillStyle = (i + j) % 2 ? '#c9bda1' : '#d2c7ac';
      g.fillRect(to(x0), to(z0), to(x1) - to(x0), to(z1) - to(z0));
    }
  }
  // Roads: asphalt strips both ways, plus the ring road around the city.
  g.fillStyle = '#3a3f46';
  for (const r of R) {
    g.fillRect(to(r - CFG.streetWidth / 2), 0, to(CFG.streetWidth), 1024);
    g.fillRect(0, to(r - CFG.streetWidth / 2), 1024, to(CFG.streetWidth));
  }
  // Lane dashes.
  g.fillStyle = '#e8d27a';
  for (const r of R) {
    for (let v = -120; v < 120; v += 12) {
      g.fillRect(to(r) - 2, to(v), 4, 14);
      g.fillRect(to(v), to(r) - 2, 14, 4);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e4da';
  for (const rx of R) for (const rz of R) {
    for (let k = -2; k <= 2; k++) {
      g.fillRect(to(rx + k * 2.2) - 3, to(rz - 8), 6, 5);
      g.fillRect(to(rx + k * 2.2) - 3, to(rz + 3), 6, 5);
      g.fillRect(to(rx - 8), to(rz + k * 2.2) - 3, 5, 6);
      g.fillRect(to(rx + 3), to(rz + k * 2.2) - 3, 5, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#2b3a4a';
  for (let y = 8; y < 120; y += 16) for (let x = 8; x < 56; x += 14) g.fillRect(x, y, 8, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground + sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 60),
    new THREE.MeshLambertMaterial({ color: CFG.palette.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.2, CFG.seaZ + 28);
  group.add(sea);

  // Buildings: 1-3 per block, varied height and warm colours, window texture.
  const winTex = windowTexture();
  const R = CFG.roads;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < R.length - 1; i++) {
    for (let j = 0; j < R.length - 1; j++) {
      const x0 = R[i] + CFG.streetWidth / 2 + 3, x1 = R[i + 1] - CFG.streetWidth / 2 - 3;
      const z0 = R[j] + CFG.streetWidth / 2 + 3, z1 = R[j + 1] - CFG.streetWidth / 2 - 3;
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.float(9, Math.min(20, (x1 - x0) / count));
        const d = rng.float(9, 18);
        const h = rng.float(7, 34);
        const x = x0 + w / 2 + (k * (x1 - x0 - w)) / Math.max(1, count - 1 || 1);
        const z = rng.float(z0 + d / 2, z1 - d / 2);
        const mat = new THREE.MeshLambertMaterial({
          color: rng.pick(CFG.palette.building), map: winTex,
        });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        // Roof lip.
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a6f52 }));
        roof.scale.set(w + 0.6, 0.6, d + 0.6);
        roof.position.set(x, h + 0.3, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palm trees along the sidewalks and the beach promenade.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 5, 6);
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: CFG.palette.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: CFG.palette.palmLeaf });
  for (let n = 0; n < 46; n++) {
    const onBeach = n >= 36;
    const x = onBeach ? rng.float(-120, 120) : rng.pick(R) + rng.pick([-9, 9]);
    const z = onBeach ? rng.float(112, 126) : rng.float(-110, 110);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2.5, z);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, 5.6, z);
    leaf.scale.y = 0.6;
    group.add(trunk, leaf);
    if (!onBeach) colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  // Street lamps at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (const rx of R) for (const rz of R) {
    if (rng.chance(0.5)) continue;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(rx + 8, 3, rz + 8);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(rx + 8, 6.2, rz + 8);
    group.add(pole, lamp);
  }

  // A few colourful billboards on the main avenue.
  for (const [x, z, col] of [[-20, -108, 0xe07856], [20, -108, 0x2e6fb0], [60, -108, 0xe8b93a]]) {
    const board = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: col }));
    board.scale.set(14, 6, 0.8);
    board.position.set(x, 12, z);
    group.add(board);
    colliders.push({ minX: x - 7, maxX: x + 7, minZ: z - 1, maxZ: z + 1 });
  }

  scene.add(group);
  return { colliders, group };
}

// Push a circle (x,z,r) out of every building AABB it overlaps.
export function resolveCollision(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  pos.x = Math.max(-CFG.worldBound, Math.min(CFG.worldBound, pos.x));
  pos.z = Math.max(-CFG.worldBound, Math.min(CFG.worldBound, pos.z));
}

// Nearest road line to (x,z): returns { axis: 'x'|'z', road, dist }.
export function nearestRoad(x, z) {
  let best = { axis: 'x', road: 0, dist: 1e9 };
  for (const r of CFG.roads) {
    const dx = Math.abs(x - r), dz = Math.abs(z - r);
    if (dx < best.dist) best = { axis: 'z', road: r, dist: dx };
    if (dz < best.dist) best = { axis: 'x', road: r, dist: dz };
  }
  return best;
}

// A pulsing mission marker: glowing cylinder + ring on the ground.
export function createBeacon(color = 0xffd23f) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  cyl.position.y = 4.5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(cyl, ring);
  g.userData.cyl = cyl;
  return g;
}
