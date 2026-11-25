// Cahaya Bay — story missions. One job: the 8-mission campaign — what each
// mission asks, how it is checked, and what it pays. Objectives are checked
// every frame against the live game state.
import * as THREE from 'three';
import { MISSION_NAMES } from './config.js';
import { createBeacon } from './city.js';
import { spawnEnemy } from './combat.js';
import { makeCar } from './vehicles.js';

function marker(G, x, z, color = 0xffd23f) {
  const b = createBeacon(color);
  b.position.set(x, 0, z);
  G.scene.add(b);
  return { x, z, beacon: b };
}

function clearMarker(G) {
  if (G.mission && G.mission.marker) {
    G.scene.remove(G.mission.marker.beacon);
    G.mission.marker = null;
  }
}

// Mission definitions. `start` sets the scene up; `check` returns
// 'done' | 'fail' | null every frame.
export const MISSIONS = [
  {
    name: MISSION_NAMES[0],
    intro: ['Raka', 'Akhirnya sampai. Cahaya Bay — kota matahari, uang, dan masalah. Temui aku di dermaga.'],
    start(G) { this.marker = marker(G, 0, 108); },
    objectiveText: () => 'Pergi ke penanda kuning di dermaga selatan.',
    check(G) { return G.player.pos.distanceTo(new THREE.Vector3(0, 0, 108)) < 4 ? 'done' : null; },
    reward: 100,
  },
  {
    name: MISSION_NAMES[1],
    intro: ['Raka', 'Kita butuh mobil, dan kita tidak akan membelinya. Ambil mobil apa pun — tekan E di dekatnya. Lalu bawa ke bengkel.'],
    start(G) { this.marker = marker(G, 60, 60); this.stolen = false; },
    objectiveText(G) { return this.stolen ? 'Bawa mobil curian ke bengkel (penanda kuning).' : 'Curi sebuah mobil: dekati lalu tekan E.'; },
    check(G) {
      if (!this.stolen && G.player.car) { this.stolen = true; G.addWanted(1, 'Mobil dilaporkan dicuri!'); }
      if (this.stolen && G.player.car && G.player.car.mesh.position.distanceTo(new THREE.Vector3(60, 0, 60)) < 6) return 'done';
      return null;
    },
    reward: 250,
  },
  {
    name: MISSION_NAMES[2],
    intro: ['Luna', 'Paket ini harus sampai ke kafe utara dalam 60 detik. Jangan tanya isinya. Gas!'],
    start(G) { this.marker = marker(G, -60, -100); this.timeLeft = 60; },
    objectiveText(G) { return `Antar paket ke kafe utara — sisa ${Math.ceil(this.timeLeft)} detik.`; },
    check(G) {
      this.timeLeft -= G.dt;
      const car = G.player.car;
      if (car && car.mesh.position.distanceTo(new THREE.Vector3(-60, 0, -100)) < 6) return 'done';
      return this.timeLeft <= 0 ? 'fail' : null;
    },
    reward: 400,
  },
  {
    name: MISSION_NAMES[3],
    intro: ['Raka', 'Polisi sudah mengendus kita. Hilangkan bintang wanted-mu — jangan buat kejahatan, dan jangan terlihat.'],
    start(G) { G.addWanted(2, 'Polisi mengejarmu!'); },
    objectiveText: () => 'Hilangkan semua bintang wanted (jangan berbuat kriminal).',
    check(G) { return G.wanted <= 0 ? 'done' : null; },
    reward: 300,
  },
  {
    name: MISSION_NAMES[4],
    intro: ['Luna', 'Tiga penagih utang menunggu di pelabuhan. Mereka tidak mau bicara. Kamu tahu harus apa. (Tembak dengan F)'],
    start(G) {
      this.marker = marker(G, -100, 60, 0xff6b35);
      for (const [x, z] of [[-100, 56], [-96, 64], [-104, 64]]) spawnEnemy(G, x, z);
      this.need = 3;
    },
    objectiveText: (G) => `Lumpuhkan penagih utang di pelabuhan — tersisa ${G.enemies.length}.`,
    check(G) { return G.enemies.length === 0 ? 'done' : null; },
    reward: 500,
  },
  {
    name: MISSION_NAMES[5],
    intro: ['Raka', 'Ada pesanan: mobil sport kuning di parkir timur. Curi, bawa ke garasi. Jangan sampai penyok parah.'],
    start(G) {
      const car = makeCar(100, -60, Math.PI / 2, 0xe8b93a, 'parked');
      G.scene.add(car.mesh);
      G.parkedCars.push(car);
      G.parkedSpecial = car;
      this.marker = marker(G, 100, 100);
    },
    objectiveText: () => 'Curi mobil sport kuning, bawa ke garasi selatan.',
    check(G) {
      const car = G.parkedSpecial;
      if (car && G.player.car === car && car.mesh.position.distanceTo(new THREE.Vector3(100, 0, 100)) < 6) return 'done';
      return null;
    },
    reward: 600,
  },
  {
    name: MISSION_NAMES[6],
    intro: ['Luna', 'Blokade di mana-mana. Kita kabur lewat dua pos pemeriksaan lalu ke rumah aman. Jangan berhenti!'],
    start(G) {
      G.addWanted(3, 'Blokade polisi diaktifkan!');
      this.marker = marker(G, -100, -100);
      this.gates = 0;
    },
    objectiveText: () => 'Tembus blokade, sampai ke rumah aman di barat laut.',
    check(G) {
      const p = G.player.car ? G.player.car.mesh.position : G.player.pos;
      return p.distanceTo(new THREE.Vector3(-100, 0, -100)) < 6 ? 'done' : null;
    },
    reward: 700,
  },
  {
    name: MISSION_NAMES[7],
    intro: ['Raka', 'Ini dia. Lima orang terakhir yang berdiri di antara kita dan kota ini. Habisi mereka, lalu ke puncak menara.'],
    start(G) {
      for (const [x, z] of [[-20, -20], [-16, -24], [-24, -16], [-20, -28], [-12, -20]]) spawnEnemy(G, x, z);
      this.marker = marker(G, 0, -20, 0xffd23f);
    },
    objectiveText: (G) => G.enemies.length > 0 ? `Lumpuhkan semua penjaga — tersisa ${G.enemies.length}.` : 'Ke puncak menara! Pergi ke penanda kuning.',
    check(G) {
      if (G.enemies.length === 0) {
        const p = G.player.car ? G.player.car.mesh.position : G.player.pos;
        if (p.distanceTo(new THREE.Vector3(0, 0, -20)) < 5) return 'done';
      }
      return null;
    },
    reward: 1000,
  },
];

export function startMission(G, index) {
  clearMarker(G);
  const def = MISSIONS[index];
  if (!def) { G.mission = null; return; }
  const m = Object.create(def);
  m.index = index;
  G.mission = m;
  G.missionIndex = index;
  m.start(G);
  G.hud.showDialog(def.intro[0], def.intro[1], 6);
  G.audio.blip(880, 0.15, 'triangle', 0.15);
  G.hud.toast(`MISI ${index + 1}: ${def.name}`);
}

export function updateMission(G) {
  const m = G.mission;
  if (!m) return;
  // Beacon pulse.
  if (m.marker) {
    const s = 1 + Math.sin(performance.now() / 300) * 0.15;
    m.marker.beacon.scale.set(s, 1, s);
  }
  const result = m.check.call(m, G);
  if (result === 'done') {
    G.cash += m.reward;
    G.hud.toast(`MISI SELESAI! +$${m.reward}`);
    G.audio.blip(1046, 0.2, 'triangle', 0.2);
    setTimeout(() => G.audio.blip(1318, 0.25, 'triangle', 0.2), 180);
    clearMarker(G);
    G.completed.push(m.index);
    if (G.missionIndex + 1 >= MISSIONS.length) {
      G.mission = null;
      G.state = 'complete';
      G.save();
    } else {
      startMission(G, G.missionIndex + 1);
    }
    G.save();
  } else if (result === 'fail') {
    G.hud.toast('MISI GAGAL — coba lagi!');
    startMission(G, m.index);
  }
}
