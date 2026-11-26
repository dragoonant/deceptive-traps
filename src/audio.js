// Tiny synthesized sound effects so the prototype needs no audio assets.
export class Audio {
  constructor() {
    this.ctx = null;
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          this.ctx = null;
        }
      }
      this.ctx?.resume?.();
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousedown', unlock);
  }

  tone({ freq = 220, to = freq, dur = 0.15, type = 'square', vol = 0.15, noise = false }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    gain.connect(ctx.destination);
    let src;
    if (noise) {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
      src.connect(filter);
      filter.connect(gain);
    } else {
      src = ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(freq, t0);
      src.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      src.connect(gain);
    }
    src.start(t0);
    src.stop(t0 + dur);
  }

  play(name) {
    switch (name) {
      case 'spring':
        return this.tone({ freq: 180, to: 900, dur: 0.2, type: 'triangle' });
      case 'clamp':
        return this.tone({ freq: 2000, to: 300, dur: 0.12, noise: true, vol: 0.3 });
      case 'ram':
        return this.tone({ freq: 600, to: 60, dur: 0.25, noise: true, vol: 0.35 });
      case 'pendulum':
        return this.tone({ freq: 3000, to: 400, dur: 0.4, noise: true, vol: 0.18 });
      case 'weight':
        return this.tone({ freq: 400, to: 40, dur: 0.5, noise: true, vol: 0.45 });
      case 'hit':
        return this.tone({ freq: 160, to: 80, dur: 0.1, type: 'square', vol: 0.12 });
      case 'combo':
        return this.tone({ freq: 500, to: 1200, dur: 0.25, type: 'sawtooth', vol: 0.08 });
      case 'hurt':
        return this.tone({ freq: 220, to: 110, dur: 0.25, type: 'sawtooth', vol: 0.15 });
      case 'place':
        return this.tone({ freq: 300, to: 450, dur: 0.08, type: 'triangle', vol: 0.12 });
      case 'deny':
        return this.tone({ freq: 140, to: 120, dur: 0.15, type: 'square', vol: 0.1 });
    }
  }
}
