// Cahaya Bay — vehicles. One job: build car meshes and drive them
// (arcade physics for the player's car; traffic/police steer their own).
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveCollision } from './city.js';

export function createCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2b36 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.2), bodyMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w); wheels.push(w);
  }
  if (opts.police) {
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3344ff }));
    lightBar.position.set(0, 1.55, -0.2);
    g.add(lightBar);
    g.userData.lightBar = lightBar;
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: CFG.palette.taxi, emissive: 0x554400 }));
    sign.position.set(0, 1.55, -0.2);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeCar(x, z, heading, color, kind = 'traffic', opts = {}) {
  const mesh = createCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh, kind, color,
    heading, speed: 0,
    driver: null,           // 'player' | 'traffic' | 'police' | null
    stuck: 0, flash: 0,
  };
}

// Player driving: arcade model — accelerate along heading, steer with speed.
export function updatePlayerCar(G, car, dt) {
  const input = G.input;
  const fwd = input.up ? 1 : input.down ? -1 : 0;
  if (input.up) car.speed += CFG.carAccel * dt;
  else if (input.down) car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 2.5 * dt);
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CFG.carBrake * dt);
  car.speed = Math.max(-CFG.carReverse, Math.min(CFG.carMaxSpeed, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (Math.abs(car.speed) > 0.5) {
    car.heading += steer * CFG.carSteer * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed);
  }
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.x += dx;
  car.mesh.position.z += dz;
  car.mesh.rotation.y = car.heading;
  resolveCollision(car.mesh.position, CFG.carRadius, G.colliders);
  // Wheel spin.
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  // Hitting pedestrians or traffic at speed is a crime.
  if (Math.abs(car.speed) > 8) {
    for (const p of G.peds) {
      if (!p.fleeing && p.mesh.position.distanceTo(car.mesh.position) < 2.2) {
        p.fleeing = true; p.fleeTime = 3;
        G.addWanted(1, 'Kamu menabrak pejalan kaki!');
      }
    }
  }
  return fwd;
}
