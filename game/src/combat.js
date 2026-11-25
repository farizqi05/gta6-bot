// Cahaya Bay — combat. One job: shooting (hitscan with a visible tracer),
// hostile NPCs for the combat missions, and player damage/death.
import * as THREE from 'three';
import { CFG } from './config.js';

export function spawnEnemy(G, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 10),
    new THREE.MeshLambertMaterial({ color: 0x8a2f2f }));
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a070 }));
  head.position.y = 1.8;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0.3, 1.2, 0.5);
  g.add(body, head, gun);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const e = { mesh: g, health: 50, shootTimer: G.rng.float(1, 2) };
  G.enemies.push(e);
  return e;
}

// Hitscan shot from the player toward the camera-forward direction on foot.
export function playerShoot(G) {
  if (!G.player || G.player.car) return;
  const now = performance.now();
  if (G.lastShotAt && now - G.lastShotAt < 220) return;
  G.lastShotAt = now;
  G.audio.ensure();
  G.audio.shot();
  const origin = G.player.pos.clone(); origin.y = 1.4;
  const dir = new THREE.Vector3(Math.sin(G.player.heading), 0, Math.cos(G.player.heading));
  const end = origin.clone().addScaledVector(dir, 40);
  let hitEnemy = null, bestD = 40;
  for (const e of G.enemies) {
    const to = e.mesh.position.clone().sub(origin); to.y = 0;
    const along = to.dot(dir);
    if (along < 0 || along > 40) continue;
    const perp = to.clone().addScaledVector(dir, -along).length();
    if (perp < 1.2 && along < bestD) { bestD = along; hitEnemy = e; }
  }
  if (hitEnemy) {
    end.copy(origin).addScaledVector(dir, bestD);
    hitEnemy.health -= 34;
    if (hitEnemy.health <= 0) {
      G.scene.remove(hitEnemy.mesh);
      G.enemies.splice(G.enemies.indexOf(hitEnemy), 1);
      G.cash += 50;
      G.hud.toast('Musuh dilumpuhkan! +$50');
      G.addWanted(1, 'Tembakan terdengar di jalan!');
    }
  }
  // Tracer line that fades in 80 ms.
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
  G.scene.add(line);
  G.tracers.push({ line, ttl: 0.08 });
  G.lastShot = { pos: origin.clone(), time: now };
  G.shake = 0.15;
}

export function updateEnemies(G, dt) {
  for (const e of [...G.enemies]) {
    const toPlayer = G.player.pos.clone().sub(e.mesh.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    e.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    e.shootTimer -= dt;
    if (dist < 26 && e.shootTimer <= 0) {
      e.shootTimer = G.rng.float(1.2, 2.4);
      // Poor aim: 40% hit chance at close range, less far away.
      if (G.rng.chance(Math.max(0.08, 0.45 - dist * 0.012)) && G.player.invuln <= 0) {
        G.player.health -= 8;
        G.hud.toast('Kamu tertembak!');
        G.audio.blip(180, 0.2, 'sawtooth', 0.2);
        G.shake = 0.3;
      }
      const geo = new THREE.BufferGeometry().setFromPoints([
        e.mesh.position.clone().setY(1.4), G.player.pos.clone().setY(1.2)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5544 }));
      G.scene.add(line);
      G.tracers.push({ line, ttl: 0.08 });
    }
  }
  for (const t of [...G.tracers]) {
    t.ttl -= dt;
    if (t.ttl <= 0) { G.scene.remove(t.line); G.tracers.splice(G.tracers.indexOf(t), 1); }
  }
}
