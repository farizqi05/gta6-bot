// Cahaya Bay — wanted level and police. One job: turn crimes into stars,
// spawn police cars that chase the player, set roadblocks at 3+ stars, and a
// helicopter at 4+ stars. Wanted decays when the player stays clean.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { resolveCollision } from './city.js';

export function spawnPoliceCar(G, nearPlayer = true) {
  const p = G.player.pos;
  const angle = G.rng.float(0, Math.PI * 2);
  const dist = nearPlayer ? G.rng.float(30, 45) : G.rng.float(60, 90);
  const x = Math.max(-110, Math.min(110, p.x + Math.sin(angle) * dist));
  const z = Math.max(-110, Math.min(110, p.z + Math.cos(angle) * dist));
  const car = makeCar(x, z, 0, CFG.palette.police, 'police', { police: true });
  car.driver = 'police';
  car.speed = 0;
  G.scene.add(car.mesh);
  G.police.push(car);
  return car;
}

export function updatePolice(G, dt) {
  // Desired police count follows the wanted level.
  const want = Math.min(G.wanted, CFG.policeMax);
  while (G.police.length < want) spawnPoliceCar(G);
  while (G.police.length > want) {
    const car = G.police.pop();
    G.scene.remove(car.mesh);
  }
  // Helicopter appears at 4+ stars.
  if (G.wanted >= 4 && !G.heli) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x22262b }));
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x888888 }));
    rotor.position.y = 0.9;
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.5, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    spot.position.y = -9;
    g.add(body, rotor, spot);
    g.userData.rotor = rotor;
    G.scene.add(g);
    G.heli = g;
  }
  if (G.wanted < 4 && G.heli) { G.scene.remove(G.heli); G.heli = null; }
  if (G.heli) {
    const t = performance.now() / 1000;
    G.heli.position.set(
      G.player.pos.x + Math.sin(t * 0.5) * 14,
      22, G.player.pos.z + Math.cos(t * 0.5) * 14);
    G.heli.userData.rotor.rotation.y += dt * 20;
  }

  // Chase: steer straight at the player, ram on contact.
  const now = performance.now();
  for (const car of G.police) {
    const target = G.player.car ? G.player.car.mesh.position : G.player.pos;
    const dx = target.x - car.mesh.position.x;
    const dz = target.z - car.mesh.position.z;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const maxSpeed = 16 + G.wanted * 2.5;
    car.speed = Math.min(maxSpeed, car.speed + 12 * dt);
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    resolveCollision(car.mesh.position, CFG.carRadius, G.colliders);
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
    // Flash the light bar.
    if (car.mesh.userData.lightBar) {
      car.flash = (car.flash || 0) + dt;
      car.mesh.userData.lightBar.material.emissive.setHex(
        Math.floor(car.flash * 4) % 2 ? 0xff2222 : 0x2244ff);
    }
    // Ram: on foot, damage + busted timer; in a car, shove the player.
    // Throttled: at most one ram per police car per 0.6 s, or the player
    // car would be stopped dead by repeated contact in a single frame.
    const d = car.mesh.position.distanceTo(target);
    if (d < 2.6 && (!car.ramAt || now - car.ramAt > 600)) {
      car.ramAt = now;
      if (G.player.car) {
        G.player.car.speed *= 0.7;
        G.player.car.mesh.position.x += Math.sin(car.heading) * 1.2;
        G.player.car.mesh.position.z += Math.cos(car.heading) * 1.2;
        G.shake = 0.4;
      } else {
        G.player.health -= 25 * dt;
        G.bustedTimer += dt;
        G.hud.toast('Polisi menangkapmu! Lari!');
      }
    }
  }

  // Roadblocks at 3+ stars: two parked police cars ahead of the player.
  if (G.wanted >= 3 && !G.roadblock) {
    const p = G.player.pos;
    const h = G.player.heading;
    const cars = [];
    for (const off of [-4, 4]) {
      const car = makeCar(p.x + Math.sin(h) * 26 + Math.cos(h) * off, p.z + Math.cos(h) * 26 - Math.sin(h) * off,
        h + Math.PI / 2, CFG.palette.police, 'police', { police: true });
      G.scene.add(car.mesh);
      cars.push(car);
    }
    G.roadblock = cars;
    G.hud.toast('BLOKADE POLISI DI DEPAN!');
  }
  if (G.wanted < 3 && G.roadblock) {
    for (const c of G.roadblock) G.scene.remove(c.mesh);
    G.roadblock = null;
  }

  // Decay: stay clean and the heat drops, one star at a time.
  if (G.wanted > 0) {
    G.cleanTimer += dt;
    if (G.cleanTimer > CFG.wantedDecaySeconds) {
      G.wanted -= 1;
      G.cleanTimer = 0;
      G.hud.toast('Bintang berkurang — polisi mulai kehilangan jejakmu.');
    }
  }
  G.audio.siren(G.wanted > 0);
}
