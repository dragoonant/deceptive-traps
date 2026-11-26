import * as THREE from 'three';
import { TRAPS, TRAP_ORDER, CATEGORIES, PLAYER } from './config.js';

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
