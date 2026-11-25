// Cahaya Bay — traffic and pedestrians. One job: make the city feel alive —
// cars driving the street grid, people walking the sidewalks, both reacting
// to the player when things get rough.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { makeHuman, animateHuman } from './humans.js';
import { resolveCollision, nearestRoad } from './city.js';

export function spawnTraffic(G, rng) {
  G.traffic = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const road = rng.pick(CFG.roads);
    const along = rng.float(-110, 110);
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + rng.pick([-2.5, 2.5]);
    const z = horizontal ? road + rng.pick([-2.5, 2.5]) : along;
    const heading = horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const color = rng.pick(CFG.palette.car);
    const car = makeCar(x, z, heading, color, 'traffic', { taxi: rng.chance(0.15) });
    car.driver = 'traffic';
    car.speed = rng.float(6, 10);
    car.axis = horizontal ? 'x' : 'z';
    G.scene.add(car.mesh);
    G.traffic.push(car);
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    // Slow down if a car is right ahead, or if the player blocks the road.
    let target = car.baseSpeed ?? car.speed;
    for (const other of G.traffic) {
      if (other === car) continue;
      if (other.mesh.position.distanceTo(car.mesh.position) < 7 && inFront(car, other)) target = 0;
    }
    if (G.player.car && G.player.car.mesh.position.distanceTo(car.mesh.position) < 8 && inFront(car, G.player.car)) target = 0;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    const dx = Math.sin(car.heading) * car.speed * dt;
    const dz = Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.x += dx;
    car.mesh.position.z += dz;
    // At an intersection, sometimes turn onto the cross street.
    const p = car.mesh.position;
    const nearX = CFG.roads.find((r) => Math.abs(p.x - r) < 1.2);
    const nearZ = CFG.roads.find((r) => Math.abs(p.z - r) < 1.2);
    if (nearX !== undefined && nearZ !== undefined && G.rng.chance(dt * 0.8)) {
      const turns = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      car.heading = turns[G.rng.int(0, 3)];
      // Snap onto the lane of the new heading.
      if (Math.abs(Math.sin(car.heading)) > 0.5) { car.mesh.position.z = nearZ + 2.5; }
      else { car.mesh.position.x = nearX + 2.5; }
    }
    // Wrap around the city edge instead of driving into the sea.
    if (p.x > 118 || p.x < -118 || p.z > 118 || p.z < -118) {
      car.heading += Math.PI;
      p.x = Math.max(-115, Math.min(115, p.x));
      p.z = Math.max(-115, Math.min(115, p.z));
    }
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  }
}

function inFront(car, other) {
  const dx = other.mesh.position.x - car.mesh.position.x;
  const dz = other.mesh.position.z - car.mesh.position.z;
  return dx * Math.sin(car.heading) + dz * Math.cos(car.heading) > 0;
}

// --- Pedestrians ---------------------------------------------------------

export function spawnPedestrians(G, rng) {
  G.peds = [];
  // Weighted archetypes: mostly beach/office/skater civilians, a few
  // vendors, and one or two foot police — so the sidewalk reads as a crowd,
  // not a row of clones. Police are rare on foot (most police are in cars).
  const pool = [
    'beach', 'beach', 'beach', 'beach', 'office', 'office', 'office',
    'skater', 'skater', 'skater', 'vendor', 'vendor', 'police',
  ];
  for (let i = 0; i < CFG.pedestrianCount; i++) {
    const road = rng.pick(CFG.roads);
    const along = rng.float(-110, 110);
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + rng.pick([-9, 9]);
    const z = horizontal ? road + rng.pick([-9, 9]) : along;
    // Beach walkers prefer the southern promenade near the sand.
    const archetype = rng.pick(pool);
    const g = makeHuman(rng, archetype);
    if (archetype === 'beach' && rng.chance(0.5)) {
      g.position.set(rng.float(-100, 100), 0, rng.float(100, 116));
    } else {
      g.position.set(x, 0, z);
    }
    const heading = horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    g.rotation.y = heading;
    G.scene.add(g);
    G.peds.push({ mesh: g, heading, speed: rng.float(1.2, 2.2), fleeing: false, fleeTime: 0, archetype });
  }
}

export function updatePedestrians(G, dt) {
  for (const p of G.peds) {
    if (p.fleeTime > 0) { p.fleeTime -= dt; if (p.fleeTime <= 0) p.fleeing = false; }
    // Flee from gunfire near them.
    if (G.lastShot && G.lastShot.time > performance.now() - 1500) {
      const d = p.mesh.position.distanceTo(G.lastShot.pos);
      if (d < 12 && !p.fleeing) { p.fleeing = true; p.fleeTime = 4; }
    }
    const speed = p.fleeing ? 5 : p.speed;
    p.mesh.position.x += Math.sin(p.heading) * speed * dt;
    p.mesh.position.z += Math.cos(p.heading) * speed * dt;
    // Walk cycle: arms/legs swing opposite, faster + wider when fleeing.
    animateHuman(p.mesh, dt, speed);
    resolveCollision(p.mesh.position, 0.5, G.colliders);
    const nearX = CFG.roads.find((r) => Math.abs(p.mesh.position.x - r) < 1);
    const nearZ = CFG.roads.find((r) => Math.abs(p.mesh.position.z - r) < 1);
    if (nearX !== undefined && nearZ !== undefined && G.rng.chance(dt * 0.5)) {
      p.heading = [0, Math.PI / 2, -Math.PI / 2, Math.PI][G.rng.int(0, 3)];
      p.mesh.rotation.y = p.heading;
    }
    if (p.mesh.position.x > 116 || p.mesh.position.x < -116 || p.mesh.position.z > 116 || p.mesh.position.z < -116) {
      p.heading += Math.PI;
      p.mesh.rotation.y = p.heading;
    }
  }
}
