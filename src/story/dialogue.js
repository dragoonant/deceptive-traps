// Visual-novel style dialogue box. While open it is the game's "modal":
// the simulation pauses, and taps / Enter / Space advance the text.
import { SPEAKERS, portrait } from './portraits.js';

const CPS = 55; // typewriter characters per second

export class Dialogue {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'dialogue';
    this.el.innerHTML = `
      <div class="dlg-box">
        <img class="dlg-portrait" alt="" />
        <div class="dlg-body">
          <div class="dlg-name"></div>
          <div class="dlg-text"></div>
          <div class="dlg-next">▼</div>
        </div>
      </div>
      <button class="dlg-skip">Skip ⏭</button>`;
    document.body.appendChild(this.el);
    this.portraitEl = this.el.querySelector('.dlg-portrait');
    this.nameEl = this.el.querySelector('.dlg-name');
    this.textEl = this.el.querySelector('.dlg-text');
    this.boxEl = this.el.querySelector('.dlg-box');
    this.active = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.target.classList.contains('dlg-skip')) this.finish();
      else this.advance();
    });
  }

  // Play a list of lines: { who, text } or { who, text, side: 'right' }.
  play(lines) {
    if (!lines || lines.length === 0) return Promise.resolve();
    this.lines = lines;
    this.index = -1;
    this.active = true;
    this.el.classList.add('show');
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.next();
    });
  }

  next() {
    this.index++;
    if (this.index >= this.lines.length) return this.finish();
    const line = this.lines[this.index];
    const sp = SPEAKERS[line.who] ?? { name: line.who, accent: '#e0b44e' };
    this.nameEl.textContent = sp.name;
    this.nameEl.style.color = sp.accent;
    this.boxEl.style.setProperty('--accent', sp.accent);
    this.boxEl.classList.toggle('right', line.side === 'right' || (line.who !== 'wren' && line.who !== 'house' && line.side !== 'left'));
    this.boxEl.classList.toggle('house', line.who === 'house');
    try {
      this.portraitEl.src = SPEAKERS[line.who] ? portrait(line.who) : '';
    } catch {
      this.portraitEl.removeAttribute('src'); // WebGL unavailable: text-only dialogue still works
    }
    this.full = line.text;
    this.shown = 0;
    this.textEl.textContent = '';
    this.el.classList.remove('done');
  }

  // First press completes the typewriter; the next press moves on.
  advance() {
    if (!this.active) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
      this.el.classList.add('done');
    } else {
      this.next();
    }
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('show');
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  // Called by the game each sim step while this is the active modal.
  update(dt, input) {
    if (!this.active) return;
    if (input.wasPressed('Enter') || input.wasPressed(' ') || input.wasPressed('f')) this.advance();
    if (input.wasPressed('Escape')) this.finish();
    for (const b of input.clicks) if (b === 0) this.advance();
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * CPS);
      this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
      if (this.shown >= this.full.length) this.el.classList.add('done');
    }
  }
}
