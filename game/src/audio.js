// Cahaya Bay — sound. One job: every sound is synthesized with WebAudio
// (no audio files, no network). Engine hum, sirens, gunshots, pickups, and a
// tiny synth radio loop. Everything is guarded: no gesture, no sound.
export class AudioMan {
  constructor() {
    this.ctx = null; this.master = null; this.engineOsc = null;
    this.engineGain = null; this.sirenOn = false; this.radioOn = false;
    this.radioTimer = null; this.muted = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned sawtooths through a low-pass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.ctx = null; }
  }

  setEngine(speed01, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.1);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speed01 * 0.1 : 0.0, t, 0.15);
  }

  blip(freq = 660, dur = 0.12, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g).connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }

  shot() {
    if (!this.ctx) return;
    try {
      const len = this.ctx.sampleRate * 0.12;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = 0.5;
      src.connect(g).connect(this.master);
      src.start();
    } catch (e) {}
  }

  siren(on) {
    if (!this.ctx || on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; g.gain.value = 0.05;
      o.connect(g).connect(this.master);
      o.start();
      const flip = () => {
        if (!this.sirenOn || !this.ctx) { try { o.stop(); } catch (e) {} return; }
        o.frequency.setValueAtTime(o.frequency.value > 800 ? 660 : 880, this.ctx.currentTime);
        setTimeout(flip, 450);
      };
      flip();
    } catch (e) {}
  }

  // A lo-fi synth radio loop: bass + pluck melody, C major pentatonic.
  toggleRadio() {
    if (!this.ctx) return false;
    this.radioOn = !this.radioOn;
    if (this.radioOn) {
      const notes = [523, 587, 659, 784, 880, 784, 659, 587];
      let i = 0;
      const step = () => {
        if (!this.radioOn || !this.ctx) return;
        this.blip(notes[i % notes.length], 0.22, 'triangle', 0.07);
        if (i % 4 === 0) this.blip(131, 0.3, 'sine', 0.12);
        i++;
        this.radioTimer = setTimeout(step, 240);
      };
      step();
    } else if (this.radioTimer) { clearTimeout(this.radioTimer); }
    return this.radioOn;
  }
}
