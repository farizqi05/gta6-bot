// Cahaya Bay — boot and the one loop. One job: own the game state (G),
// wire every system together, read input, and run the frame loop.
// ?seed=N fixes the traffic pattern. ?shot=start|drive|chase|mission
// (&seed=N) stages that scene, then keeps the real game running.
import * as THREE from 'three';
import { CFG } from './config.js';
import { RNG } from './random.js';
import { buildCity } from './city.js';
import { AudioMan } from './audio.js';
import { Player, updateCamera } from './player.js';
import { makeCar, updatePlayerCar } from './vehicles.js';
import { spawnTraffic, updateTraffic, spawnPedestrians, updatePedestrians } from './traffic.js';
import { updatePolice } from './police.js';
import { playerShoot, updateEnemies } from './combat.js';
import { startMission, updateMission } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));

// --- Game state -----------------------------------------------------------
const G = {
  state: 'title', // title | play | paused | busted | wasted | complete
  rng: new RNG(seed),
  cash: 200,
  wanted: 0,
  cleanTimer: 0,
  bustedTimer: 0,
  missionIndex: 0,
  mission: null,
  completed: [],
  traffic: [], peds: [], police: [], enemies: [], tracers: [],
  parkedCars: [], parkedSpecial: null, heli: null, roadblock: null,
  camYaw: 0, camOrbit: 0, shake: 0, dt: 0, lastShotAt: 0, lastShot: null,
  input: { up: false, down: false, left: false, right: false, run: false, brake: false },
};

G.addWanted = (n, msg) => {
  G.wanted = Math.min(CFG.wantedMax, G.wanted + n);
  G.cleanTimer = 0;
  if (msg) G.hud.toast(msg);
};

G.save = () => saveGame(G);

// --- Renderer / scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);
G.renderer = renderer;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.palette.sky);
scene.fog = new THREE.Fog(CFG.palette.sky, 130, 280);
G.scene = scene;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 20, 60);
G.camera = camera;

scene.add(new THREE.HemisphereLight(0xffe0b3, 0x8a6f52, 0.95));
const sun = new THREE.DirectionalLight(0xffe0b3, 1.4);
sun.position.set(60, 90, -50);
scene.add(sun);

const { colliders } = buildCity(scene, G.rng);
G.colliders = colliders;

G.audio = new AudioMan();
G.hud = new HUD();
G.player = new Player(scene);
G.player.health = CFG.playerHealth;

spawnTraffic(G, G.rng);
spawnPedestrians(G, G.rng);

// A few parked cars the player can steal right away.
for (const [x, z, h] of [[20, -22, 0], [-20, 22, Math.PI / 2], [60, -62, 0], [-60, 62, Math.PI], [100, 22, Math.PI / 2], [-100, -22, 0]]) {
  const car = makeCar(x, z, h, G.rng.pick(CFG.palette.car), 'parked');
  scene.add(car.mesh);
  G.parkedCars.push(car);
}

// --- Overlays ---------------------------------------------------------------
const overlays = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  end: document.getElementById('end-screen'),
  hud: document.getElementById('hud'),
};

function showOnly(name) {
  for (const [k, el] of Object.entries(overlays)) {
    if (k === 'hud') { el.classList.toggle('hidden', name === 'title'); continue; }
    el.classList.toggle('hidden', k !== name);
  }
  if (name === 'title') {
    document.getElementById('btn-continue').classList.toggle('hidden', !hasSave());
    document.getElementById('title-stats').textContent = hasSave()
      ? 'Save ditemukan — lanjutkan dari misi ' + ((loadGame().missionIndex || 0) + 1) + '.'
      : 'Kota baru, cerita baru. 8 misi menunggumu.';
  }
}
G.hideOverlays = () => {
  for (const el of Object.values(overlays)) el.classList.add('hidden');
  overlays.hud.classList.remove('hidden');
};

function showEnd(title, text) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  document.getElementById('end-stats').textContent =
    `Uang: $${G.cash} — Misi selesai: ${G.completed.length}/8 — Wanted: ${G.wanted}★`;
  showOnly('end');
}

function newGame() {
  G.cash = 200; G.wanted = 0; G.cleanTimer = 0; G.bustedTimer = 0;
  G.completed = []; G.missionIndex = 0;
  G.player.health = CFG.playerHealth;
  G.player.pos.set(0, 0, 40);
  G.player.heading = Math.PI;
  if (G.player.car) G.player.exitCar(G);
  G.state = 'play';
  showOnly(null);
  startMission(G, 0);
  G.audio.ensure();
}

function continueGame() {
  const s = loadGame();
  if (!s) return newGame();
  G.cash = s.cash; G.missionIndex = s.missionIndex; G.completed = s.completed || [];
  G.player.health = s.health ?? CFG.playerHealth;
  G.player.pos.set(s.pos ? s.pos[0] : 0, 0, s.pos ? s.pos[1] : 40);
  G.state = 'play';
  showOnly(null);
  startMission(G, G.missionIndex);
  G.audio.ensure();
}

document.getElementById('btn-start').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', () => { G.state = 'play'; showOnly(null); });
document.getElementById('btn-restart').addEventListener('click', () => {
  G.player.health = CFG.playerHealth; G.wanted = 0; G.bustedTimer = 0;
  G.player.pos.set(0, 0, 40);
  if (G.player.car) G.player.exitCar(G);
  G.state = 'play'; showOnly(null);
});
document.getElementById('btn-title').addEventListener('click', () => { G.state = 'title'; showOnly('title'); });

// --- Input ------------------------------------------------------------------
const KEYMAP = {
  [CFG.controls.up]: 'up', [CFG.controls.down]: 'down',
  [CFG.controls.left]: 'left', [CFG.controls.right]: 'right',
  [CFG.controls.run]: 'run', [CFG.controls.brake]: 'brake',
};

window.addEventListener('keydown', (e) => {
  if (e.code in KEYMAP) { G.input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === CFG.controls.enterCar && G.state === 'play') toggleCar();
  if (e.code === CFG.controls.shoot && G.state === 'play') playerShoot(G);
  if (e.code === CFG.controls.radio && G.state === 'play') {
    G.audio.ensure();
    G.hud.toast(G.audio.toggleRadio() ? 'Radio: CAHAYA FM nyala' : 'Radio mati');
  }
  if (e.code === CFG.controls.pause) {
    if (G.state === 'play') { G.state = 'paused'; showOnly('pause'); }
    else if (G.state === 'paused') { G.state = 'play'; showOnly(null); }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code in KEYMAP) G.input[KEYMAP[e.code]] = false;
});

// Mouse drag orbits the camera; a plain click shoots.
let dragging = false, moved = 0, lastX = 0;
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; moved = 0; lastX = e.clientX; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
  G.camOrbit += dx * 0.005;
});
window.addEventListener('mouseup', () => {
  if (dragging && moved < 5 && G.state === 'play') playerShoot(G);
  dragging = false;
});

function nearestCar(maxDist) {
  const p = G.player.pos;
  let best = null, bestD = maxDist;
  const consider = (car) => {
    const d = car.mesh.position.distanceTo(p);
    if (d < bestD) { bestD = d; best = car; }
  };
  for (const c of G.traffic) consider(c);
  for (const c of G.parkedCars) consider(c);
  return best;
}

function toggleCar() {
  if (G.player.car) { const car = G.player.car; G.player.exitCar(G); G.parkedCars.push(car); return; }
  const car = nearestCar(4);
  if (!car) { G.hud.toast('Tidak ada mobil di dekatmu.'); return; }
  const wasTraffic = G.traffic.includes(car);
  if (wasTraffic) {
    G.traffic.splice(G.traffic.indexOf(car), 1);
    G.addWanted(1, 'Mobil dicuri — pemiliknya menelepon polisi!');
  } else {
    G.parkedCars.splice(G.parkedCars.indexOf(car), 1);
    G.addWanted(1, 'Mobil dicuri — pemiliknya menelepon polisi!');
  }
  car.speed = 0;
  G.player.enterCar(G, car);
}

// --- Simulation step --------------------------------------------------------
G.tick = function (dt, silent = false) {
  G.dt = dt;
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  if (G.state === 'play' || silent) {
    updatePolice(G, dt);
    updateEnemies(G, dt);
    updateMission(G);
  }
  if (G.state === 'play') {
    if (G.player.car) updatePlayerCar(G, G.player.car, dt);
    else G.player.updateOnFoot(G, dt);
    // Busted / wasted checks.
    if (G.player.health <= 0) {
      G.state = 'wasted';
      G.cash = Math.max(0, G.cash - 200);
      showEnd('KAMU TUMBANG', 'Rumah sakit Cahaya merawatmu. Uangmu berkurang $200.');
      G.save();
    } else if (G.bustedTimer > 2) {
      G.state = 'busted';
      G.wanted = 0;
      G.bustedTimer = 0;
      showEnd('TERTANGKAP!', 'Polisi Cahaya membawamu ke kantor. Kamu bebas, tapi misi berlanjut.');
      G.save();
    } else if (G.bustedTimer > 0) {
      G.bustedTimer = Math.max(0, G.bustedTimer - dt * 0.5);
    }
    G.audio.setEngine(G.player.car ? Math.abs(G.player.car.speed) / CFG.carMaxSpeed : 0, !!G.player.car);
  }
  updateCamera(G, dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
};

// --- Frame loop --------------------------------------------------------------
let last = performance.now();
let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'play' || G.state === 'title') {
    G.tick(dt);
    if (G.state === 'play') G.hud.update(G, dt);
  }
  // Camera shake.
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.5;
  }
  renderer.render(scene, camera);
  frames++;
  if (frames === 3 && shotName) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = G;
showOnly('title');
if (shotName) {
  try { applyShot(G, shotName, seed); } catch (e) { window.__errors.push('shot: ' + e.message); }
  if (G.state === 'title') showOnly('title');
  else G.hideOverlays();
}
requestAnimationFrame(frame);
