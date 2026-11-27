// Comic-panel cutscenes: panels are rendered from 3D tableaux, then revealed
// one at a time with a caption. Tap / Enter advances, Skip ends it.
import * as THREE from 'three';
import { TABLEAUX } from './tableaux.js';
import { snapshot } from './studio.js';

const imageCache = new Map();

function renderPanel(id) {
  if (imageCache.has(id)) return imageCache.get(id);
  const scene = new THREE.Scene();
  const cam = TABLEAUX[id](scene);
  const url = snapshot(scene, cam, 800, 500, 1.25);
  imageCache.set(id, url);
  return url;
}

export class Cutscene {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'cutscene';
    this.el.innerHTML = `
      <div class="cs-title"></div>
      <div class="cs-page"></div>
      <div class="cs-hint">Tap or press Enter</div>
      <button class="cs-skip">Skip ⏭</button>`;
    document.body.appendChild(this.el);
    this.page = this.el.querySelector('.cs-page');
    this.titleEl = this.el.querySelector('.cs-title');
    this.active = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.target.classList.contains('cs-skip')) this.finish();
      else this.advance();
    });
  }

  // panels: [{ scene: tableauId, caption }]; title shown above the page.
  play({ title = '', panels }) {
    this.active = true;
    this.panels = panels;
    this.index = -1;
    this.titleEl.innerHTML = title;
    this.page.innerHTML = '';
    this.page.dataset.count = panels.length;
    this.el.classList.add('show');
    // Build every panel up front (hidden) so the layout doesn't jump.
    this.cells = panels.map((p, k) => {
      const cell = document.createElement('figure');
      cell.className = 'cs-panel';
      cell.style.setProperty('--tilt', `${(k % 2 ? 1 : -1) * (0.4 + (k % 3) * 0.3)}deg`);
      const img = document.createElement('img');
      img.alt = '';
      const cap = document.createElement('figcaption');
      cap.textContent = p.caption;
      cell.append(img, cap);
      this.page.appendChild(cell);
      return { cell, img, scene: p.scene };
    });
    return new Promise((resolve) => {
      this.resolve = resolve;
      // Let the overlay paint before the (synchronous) renders.
      requestAnimationFrame(() => this.advance());
    });
  }

  advance() {
    if (!this.active) return;
    this.index++;
    if (this.index >= this.cells.length) return this.finish();
    const c = this.cells[this.index];
    // Small screens show one panel at a time; mark the current one.
    for (const other of this.cells) other.cell.classList.remove('current');
    c.cell.classList.add('current');
    try {
      c.img.src = renderPanel(c.scene);
    } catch {
      c.cell.classList.add('noimg'); // no WebGL: captions still tell the story
    }
    c.cell.classList.add('in');
    // Pre-render the next panel while the player reads this one.
    const nxt = this.cells[this.index + 1];
    if (nxt) setTimeout(() => {
      try {
        renderPanel(nxt.scene);
      } catch {
        /* rendered on demand instead */
      }
    }, 250);
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('show');
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  update(dt, input) {
    if (!this.active) return;
    if (input.wasPressed('Enter') || input.wasPressed(' ') || input.wasPressed('f')) this.advance();
    if (input.wasPressed('Escape')) this.finish();
    for (const b of input.clicks) if (b === 0) this.advance();
  }
}
