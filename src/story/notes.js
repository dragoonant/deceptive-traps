// Notes pinned to the manor's walls. Walk up to one during setup and read it
// (F on keyboard, or tap the Read button). Reading pauses the game.
import * as THREE from 'three';
import { TILE } from '../config.js';
import { tileCenter } from '../level.js';

const READ_RANGE = 1.9;

function pageTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#efe3c4';
  g.fillRect(0, 0, 96, 128);
  g.strokeStyle = 'rgba(90,60,30,0.75)';
  g.lineWidth = 2;
  let s = seed * 97 + 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 16; y < 118; y += 9) {
    g.beginPath();
    g.moveTo(10, y);
    g.lineTo(10 + 60 + rnd() * 16, y + (rnd() - 0.5) * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Notes {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.read = new Set();
    this.el = document.createElement('div');
    this.el.id = 'note-reader';
    this.el.innerHTML = `<div class="note-paper"><h3></h3><div class="note-body"></div><div class="note-close">Tap or press F to close</div></div>`;
    document.body.appendChild(this.el);
    this.active = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.close();
    });
  }

  load(defs) {
    for (const it of this.items) this.scene.remove(it.group);
    this.items = [];
    this.read.clear();
    defs.forEach((d, k) => {
      const g = new THREE.Group();
      const page = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.72),
        new THREE.MeshStandardMaterial({ map: pageTexture(k + 1), emissive: 0x3a2a10, emissiveIntensity: 0.6, roughness: 0.9 })
      );
      page.rotation.z = (k % 2 ? 1 : -1) * 0.06;
      g.add(page);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshStandardMaterial({ color: 0xa02020 }));
      pin.position.set(0, 0.3, 0.02);
      g.add(pin);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6, depthWrite: false })
      );
      halo.position.z = -0.005;
      g.add(halo);
      const c = tileCenter(d.i, d.j);
      g.position.set(c.x + d.side.x * (TILE / 2 - 0.03), 1.45, c.z + d.side.z * (TILE / 2 - 0.03));
      g.rotation.y = Math.atan2(-d.side.x, -d.side.z);
      this.scene.add(g);
      // Reading spot: a little in front of the page.
      const spot = new THREE.Vector3(c.x + d.side.x * 0.4, 0, c.z + d.side.z * 0.4);
      this.items.push({ def: d, group: g, halo, spot });
    });
  }

  get total() {
    return this.items.length;
  }

  // Closest unread-or-read note in reach of the Keeper, or null.
  nearest(pos) {
    let best = null;
    let bd = READ_RANGE;
    for (const it of this.items) {
      const d = Math.hypot(it.spot.x - pos.x, it.spot.z - pos.z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  open(item) {
    this.active = true;
    this.read.add(item.def.id);
    this.el.querySelector('h3').textContent = item.def.title;
    this.el.querySelector('.note-body').innerHTML = item.def.body
      .split('\n')
      .map((p) => `<p>${p}</p>`)
      .join('');
    this.el.classList.add('show');
    return new Promise((resolve) => (this.resolve = resolve));
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('show');
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  update(dt, input) {
    if (!this.active) return;
    if (input.wasPressed('f') || input.wasPressed('Escape') || input.wasPressed('Enter') || input.wasPressed(' ')) this.close();
    for (const b of input.clicks) if (b === 0) this.close();
  }

  // Bob and pulse the halos; unread notes glow brighter.
  animate(time) {
    for (const it of this.items) {
      const unread = !this.read.has(it.def.id);
      it.halo.material.opacity = unread ? 0.45 + 0.35 * Math.sin(time * 3) : 0.12;
      it.group.position.y = 1.45 + Math.sin(time * 1.6 + it.spot.x) * 0.02;
    }
  }
}
