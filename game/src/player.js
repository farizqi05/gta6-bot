// Cahaya Bay — the player on foot, plus the chase camera. One job: move the
// character, enter/exit cars, and keep the camera behind the action.
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveCollision } from './city.js';
import { makeHuman, animateHuman } from './humans.js';

// The player is a detailed 'protagonist' human (see humans.js): head with
// face + sunglasses, open jacket over a tee, arms and legs that swing.
// userData.legs / userData.rig are kept, so nothing else needs to change.
export function createPlayerMesh() {
  return makeHuman(null, 'protagonist');
}

export class Player {
  constructor(scene) {
    this.mesh = createPlayerMesh();
    this.mesh.position.set(0, 0, 40);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0;
    this.health = CFG.playerHealth;
    this.car = null;        // car object when driving, else null
    this.walkPhase = 0;
    this.invuln = 0;
  }

  // On-foot movement, camera-relative. Returns true when moving.
  updateOnFoot(G, dt) {
    const input = G.input;
    const camYaw = G.camYaw;
    let mx = 0, mz = 0;
    if (input.up) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.down) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.left) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.right) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const speed = input.run ? CFG.playerRun : CFG.playerWalk;
      mx /= len; mz /= len;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.heading = Math.atan2(mx, mz);
      this.mesh.rotation.y = this.heading;
      animateHuman(this.mesh, dt, speed);
    } else {
      animateHuman(this.mesh, dt, 0);
    }
    resolveCollision(this.pos, CFG.playerRadius, G.colliders);
    if (this.invuln > 0) this.invuln -= dt;
    return len > 0;
  }

  enterCar(G, car) {
    car.driver = 'player';
    this.car = car;
    this.mesh.visible = false;
    G.hud.toast('Mobil diambil — tekan E untuk keluar');
    G.audio.ensure();
  }

  exitCar(G) {
    const car = this.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    this.car = null;
    // Step out to the side of the car.
    const side = Math.cos(car.heading) > 0 ? 1 : -1;
    this.pos.set(car.mesh.position.x + 2.4 * side, 0, car.mesh.position.z);
    this.mesh.visible = true;
    this.heading = car.heading;
    this.mesh.rotation.y = this.heading;
  }
}

// Chase camera. While driving it sits behind the car's heading; on foot it
// holds its yaw (plus the player's mouse orbit) so WASD stays predictable —
// easing the camera toward the walker's heading would bend every step into
// a curve, because the movement keys are camera-relative.
export function updateCamera(G, dt) {
  const target = G.player.car ? G.player.car.mesh.position : G.player.pos;
  const heading = G.player.car ? G.player.car.heading : G.player.heading;
  if (G.player.car) {
    let desired = heading + Math.PI + G.camOrbit;
    let diff = desired - G.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.camYaw += diff * Math.min(1, dt * 2.2);
  } else {
    G.camYaw += G.camOrbit;
  }
  G.camOrbit = 0;
  const dist = G.player.car ? 19 : 15;
  const height = G.player.car ? 10 : 11;
  const cx = target.x + Math.sin(G.camYaw) * dist;
  const cz = target.z + Math.cos(G.camYaw) * dist;
  G.camera.position.lerp(new THREE.Vector3(cx, height, cz), Math.min(1, dt * 5));
  G.camera.lookAt(target.x, target.y + 1.5, target.z);
}
