// Cahaya Bay — HUD. One job: the on-screen interface (health, cash, wanted
// stars, speed, mission objective, dialogue, toasts) and the 2D minimap.
import { CFG } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['health-fill', 'health-num', 'cash', 'stars', 'speed',
      'speed-box', 'objective', 'mission-name', 'dialog', 'dialog-speaker',
      'dialog-text', 'toast', 'minimap', 'crosshair', 'hud']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el['minimap'] ? this.el['minimap'].getContext('2d') : null;
    this.dialogTimer = 0;
    this.toastTimer = 0;
  }

  showDialog(speaker, text, seconds = 5) {
    if (!this.el['dialog']) return;
    this.el['dialog-speaker'].textContent = speaker;
    this.el['dialog-text'].textContent = text;
    this.el['dialog'].classList.remove('hidden');
    this.dialogTimer = seconds;
  }

  toast(text, seconds = 3) {
    if (!this.el['toast']) return;
    this.el['toast'].textContent = text;
    this.el['toast'].classList.remove('hidden');
    this.toastTimer = seconds;
  }

  update(G, dt) {
    const e = this.el;
    if (this.dialogTimer > 0) { this.dialogTimer -= dt; if (this.dialogTimer <= 0) e['dialog'].classList.add('hidden'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) e['toast'].classList.add('hidden'); }
    const hp = Math.max(0, Math.round(G.player.health));
    e['health-fill'].style.width = hp + '%';
    e['health-num'].textContent = hp;
    e['cash'].textContent = '$' + G.cash.toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < CFG.wantedMax; i++) stars += i < G.wanted ? '★' : '☆';
    e['stars'].textContent = stars;
    e['stars'].style.color = G.wanted > 0 ? '#ffd23f' : '#ffffff88';
    const inCar = !!G.player.car;
    e['speed-box'].classList.toggle('hidden', !inCar);
    if (inCar) e['speed'].textContent = Math.round(Math.abs(G.player.car.speed) * 3.6) + ' km/h';
    e['crosshair'].classList.toggle('hidden', inCar || G.state !== 'play');
    const m = G.mission;
    e['mission-name'].textContent = m ? 'MISI ' + (G.missionIndex + 1) + ' — ' + m.name : 'CAHAYA BAY';
    e['objective'].textContent = m ? m.objectiveText(G) : 'Jelajahi kota. Tekan E di dekat mobil untuk naik.';
    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = 180, W = 280; // canvas px, world size
    const to = (v) => ((v + W / 2) / W) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#d8cbb0'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2e7f9e'; ctx.fillRect(0, to(138), S, S - to(138));
    ctx.fillStyle = '#e8c98a'; ctx.fillRect(0, to(118), S, to(138) - to(118));
    ctx.fillStyle = '#3a3f46';
    for (const r of CFG.roads) {
      ctx.fillRect(to(r - 6), 0, to(12) - to(0), S);
      ctx.fillRect(0, to(r - 6), S, to(12) - to(0));
    }
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(to(x), to(z), r, 0, Math.PI * 2); ctx.fill();
    };
    if (G.mission && G.mission.marker) {
      const p = G.mission.marker;
      const pulse = 3 + Math.sin(performance.now() / 250) * 1.5;
      dot(p.x, p.z, '#ffd23f', pulse);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(to(p.x), to(p.z), pulse + 4, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of G.traffic) dot(c.mesh.position.x, c.mesh.position.z, '#e8b93a', 2.5);
    for (const p of G.peds) dot(p.mesh.position.x, p.mesh.position.z, '#ffffff', 1.5);
    for (const e of G.enemies) dot(e.mesh.position.x, e.mesh.position.z, '#ff6b35', 3);
    for (const p of G.police) dot(p.mesh.position.x, p.mesh.position.z, '#3a7bff', 3.5);
    // Player arrow (car position when driving).
    const pp = G.player.car ? G.player.car.mesh.position : G.player.pos;
    const px = to(pp.x), pz = to(pp.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-(G.player.car ? G.player.car.heading : G.player.heading));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}
