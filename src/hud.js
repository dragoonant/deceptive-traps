import * as THREE from 'three';
import { TRAPS, TRAP_ORDER, CATEGORIES, PLAYER } from './config.js';
import { W, D, AREAS, DOORS, areaAt, areaNameAt, HALF_W, HALF_D } from './level.js';

const MINI = 9; // minimap pixels per tile

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(camera) {
    this.camera = camera;
    this.floaters = [];
    this.bars = new Map();
    this.layer = $('world-layer');
    this.bannerTimer = 0;
    this.comboTimer = 0;
    this.buildPalette();
    this.initMinimap();
  }

  initMinimap() {
    const c = $('minimap');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * MINI * dpr;
    c.height = D * MINI * dpr;
    c.style.width = `${W * MINI}px`;
    c.style.height = `${D * MINI}px`;
    this.mini = c.getContext('2d');
    this.mini.scale(dpr, dpr);
    // Static layer: floors and doors, drawn once.
    const base = document.createElement('canvas');
    base.width = c.width;
    base.height = c.height;
    const g = base.getContext('2d');
    g.scale(dpr, dpr);
    for (let j = 0; j < D; j++) {
      for (let i = 0; i < W; i++) {
        const a = areaAt(i, j);
        if (!a) continue;
        const col = AREAS[a].floor;
        g.fillStyle = `rgba(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255},0.28)`;
        g.fillRect(i * MINI + 0.5, j * MINI + 0.5, MINI - 1, MINI - 1);
      }
    }
    g.fillStyle = '#d4a84a';
    for (const d of Object.values(DOORS)) {
      const x = d.i * MINI + MINI / 2 + d.side.x * MINI * 0.55;
      const y = d.j * MINI + MINI / 2 + d.side.z * MINI * 0.55;
      g.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    this.miniBase = base;
  }

  drawMinimap(game) {
    const g = this.mini;
    g.clearRect(0, 0, W * MINI, D * MINI);
    g.drawImage(this.miniBase, 0, 0, W * MINI, D * MINI);
    const toPx = (x, z) => [((x + HALF_W) / (HALF_W * 2)) * W * MINI, ((z + HALF_D) / (HALF_D * 2)) * D * MINI];
    for (const t of game.traps) {
      const col = t.def.color;
      g.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
      const inset = t.category === 'ceiling' ? 1.5 : t.category === 'wall' ? 3 : 2.5;
      g.fillRect(t.i * MINI + inset, t.j * MINI + inset, MINI - inset * 2, MINI - inset * 2);
    }
    for (const n of game.intruders) {
      if (!n.alive) continue;
      const [x, y] = toPx(n.pos.x, n.pos.z);
      g.fillStyle = '#ff4a4a';
      g.beginPath();
      g.arc(x, y, n.type === 'knight' ? 3.5 : 2.6, 0, Math.PI * 2);
      g.fill();
    }
    const p = game.player;
    const [px, py] = toPx(p.pos.x, p.pos.z);
    g.fillStyle = '#ffe08a';
    g.beginPath();
    g.arc(px, py, 3, 0, Math.PI * 2);
    g.fill();
    // Facing tick.
    g.strokeStyle = '#ffe08a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.sin(p.facing) * 7, py + Math.cos(p.facing) * 7);
    g.stroke();
  }

  buildPalette() {
    const pal = $('palette');
    pal.innerHTML = '';
    TRAP_ORDER.forEach((type, idx) => {
      const d = TRAPS[type];
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.type = type;
      el.innerHTML = `<span class="key">${idx + 1}</span><span class="swatch" style="background:#${d.color
        .toString(16)
        .padStart(6, '0')}"></span><span class="nm">${d.name}</span><span class="meta">${
        CATEGORIES[d.category].label
      } · ${d.cost}⚙</span>`;
      pal.appendChild(el);
    });
    const trig = $('triggers');
    trig.innerHTML = '';
    for (const [cat, c] of Object.entries(CATEGORIES)) {
      const el = document.createElement('div');
      el.className = 'slot trig';
      el.dataset.cat = cat;
      el.innerHTML = `<span class="key">${c.key}</span><span class="nm">${c.label}</span><span class="meta"></span>`;
      trig.appendChild(el);
    }
  }

  setScreen(name, data = {}) {
    for (const s of ['title', 'victory', 'defeat']) $(`screen-${s}`).classList.toggle('show', s === name);
    if (name === 'victory' || name === 'defeat') {
      $(`${name}-stats`).innerHTML = `Score <b>${data.score}</b> · Kills <b>${data.kills}</b> · Best combo <b>${data.bestCombo}</b>`;
    }
  }

  update(game) {
    const p = game.player;
    $('hp-fill').style.width = `${(p.hp / PLAYER.maxHp) * 100}%`;
    $('hp-text').textContent = `${Math.ceil(p.hp)}`;
    $('cogs').textContent = game.cogs;
    $('score').textContent = game.score;
    $('wave').textContent = `Wave ${Math.min(game.waveIndex + 1, game.waveCount)} / ${game.waveCount}`;
    const phase = $('phase');
    if (game.state === 'setup') phase.textContent = 'Setup: place traps, then press Enter';
    else if (game.state === 'wave') phase.textContent = `Intruders: ${game.aliveCount()} remaining`;
    else phase.textContent = '';
    $('room-name').textContent = areaNameAt(p.pos.x, p.pos.z);
    this.drawMinimap(game);

    const setup = game.state === 'setup';
    $('palette').classList.toggle('show', setup);
    $('triggers').classList.toggle('show', game.state === 'wave');
    for (const el of $('palette').children) {
      const type = el.dataset.type;
      el.classList.toggle('active', type === game.selectedType);
      el.classList.toggle('poor', TRAPS[type].cost > game.cogs);
    }
    for (const el of $('triggers').children) {
      const info = game.categoryStatus(el.dataset.cat);
      el.classList.toggle('armed', info.armed > 0);
      el.classList.toggle('empty', info.total === 0);
      el.querySelector('.meta').textContent =
        info.total === 0 ? 'none placed' : `${info.ready}/${info.total} ready${info.armed ? ' · TARGET' : ''}`;
    }

    $('build-info').classList.toggle('show', setup);
    if (setup) {
      const d = TRAPS[game.selectedType];
      $('build-info').innerHTML = `<b>${d.name}</b> (${d.cost}⚙): ${d.desc}<br><span class="dim">${
        game.placementHint
      }</span>`;
    }

    $('lock-hint').classList.toggle('show', !game.input.locked && (game.state === 'setup' || game.state === 'wave'));
    $('crosshair').classList.toggle('show', setup);

    // Banner + combo fade.
    this.bannerTimer -= game.dt;
    $('banner').classList.toggle('show', this.bannerTimer > 0);
    this.comboTimer -= game.dt;
    $('combo').classList.toggle('show', this.comboTimer > 0);

    this.updateFloaters(game.dt);
    this.updateBars(game.intruders);
  }

  banner(html, time = 2) {
    $('banner').innerHTML = html;
    this.bannerTimer = time;
  }

  showCombo(chain, mult, final = null) {
    const el = $('combo');
    const count = chain.length;
    const list = chain.map((c) => `<span>${c}</span>`).join('<i>›</i>');
    el.innerHTML = `<div class="count">${count} HIT${count > 1 ? 'S' : ''}${
      final ? ` <em>+${final}</em>` : ` <small>×${mult.toFixed(2)}</small>`
    }</div><div class="chain">${list}</div>`;
    el.classList.toggle('final', !!final);
    this.comboTimer = final ? 2.2 : 3;
  }

  flashHurt() {
    const v = $('vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  }

  floatText(worldPos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    this.floaters.push({ el, pos: worldPos.clone().add(new THREE.Vector3(0, 2.2, 0)), life: 1.1 });
  }

  project(pos) {
    const v = pos.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      visible: v.z < 1,
    };
  }

  updateFloaters(dt) {
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      f.pos.y += dt * 1.2;
      if (f.life <= 0) {
        f.el.remove();
        return false;
      }
      const s = this.project(f.pos);
      f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = Math.min(1, f.life * 2);
      f.el.style.display = s.visible ? '' : 'none';
      return true;
    });
  }

  updateBars(intruders) {
    const seen = new Set();
    for (const n of intruders) {
      if (!n.alive) continue;
      seen.add(n.id);
      let el = this.bars.get(n.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hpbar';
        el.innerHTML = '<div></div><span></span>';
        this.layer.appendChild(el);
        this.bars.set(n.id, el);
      }
      const s = this.project(n.pos.clone().add(new THREE.Vector3(0, 2.1 * n.def.scale, 0)));
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      el.style.display = s.visible ? '' : 'none';
      el.firstChild.style.width = `${(n.hp / n.def.hp) * 100}%`;
      const st = n.state === 'restrained' ? 'PINNED' : n.state === 'stunned' ? 'STUNNED' : '';
      el.lastChild.textContent = st;
    }
    for (const [id, el] of this.bars) {
      if (!seen.has(id)) {
        el.remove();
        this.bars.delete(id);
      }
    }
  }

  clearWorld() {
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    for (const el of this.bars.values()) el.remove();
    this.bars.clear();
  }
}
