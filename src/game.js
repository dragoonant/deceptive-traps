import * as THREE from 'three';
import { TRAPS, TRAP_ORDER, CATEGORIES, SELL_REFUND, INTRUDERS, TILE } from './config.js';
import { Room } from './room.js';
import {
  tileCenter,
  worldToTile,
  isWalkable,
  isDoorTile,
  DOORS,
  flowField,
  nextStep,
  lineOfSight,
} from './level.js';
import { Player, ThirdPersonCamera } from './player.js';
import { Intruder } from './intruder.js';
import { Trap, makeGhost, allowedDirs, dirAngle } from './traps.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Fx } from './fx.js';
import { OBSTACLES } from './level.js';
import { NIGHT1 } from './story/night1.js';
import { BARKS } from './story/barks.js';
import { Dialogue } from './story/dialogue.js';
import { Cutscene } from './story/cutscene.js';
import { Notes } from './story/notes.js';

export class Game {
  constructor({ renderer, scene, camera, input }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.room = new Room(scene);
    this.player = new Player(scene);
    this.cam = new ThirdPersonCamera(camera);
    this.hud = new Hud(camera);
    this.fx = new Fx(scene);
    this.freeze = 0; // hit-stop: seconds of frozen simulation left
    for (const o of OBSTACLES) {
      const c = tileCenter(o.i, o.j);
      if (o.type === 'furnace') this.fx.addEmbers({ x: c.x + 0.9, y: 0.9, z: c.z });
      if (o.type === 'boiler') this.fx.addSteam({ x: c.x + 0.3, y: 3.2, z: c.z });
    }
    this.audio = new Audio();
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.night = NIGHT1;
    this.waveCount = this.night.waves.length;
    this.dialogue = new Dialogue();
    this.cutscene = new Cutscene();
    this.notes = new Notes(scene);
    this.notes.load(this.night.notes);
    this.introSeen = false;
    this.nearNote = null;
    const readBtn = document.getElementById('read-btn');
    readBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.readNearbyNote();
    });
    this.time = 0;
    this.dt = 0;
    this.shakeAmt = 0;

    this.traps = [];
    this.intruders = [];
    this.selectedType = TRAP_ORDER[0];
    this.dirIndex = 0;
    this.ghost = null;
    this.ghostType = null;
    this.target = null; // {i, j} under the crosshair
    this.placementHint = '';

    // Zone highlight tiles under the ghost.
    this.zoneMeshes = [];
    const zg = new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(
        zg,
        new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.25, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      m.visible = false;
      scene.add(m);
      this.zoneMeshes.push(m);
    }

    // Brightness presets (tone-mapping exposure). Remembered per browser.
    this.brightnessLevels = [
      { name: 'Normal', exposure: 1.15 },
      { name: 'Bright', exposure: 1.6 },
      { name: 'Max', exposure: 2.2 },
    ];
    let saved = 0;
    try {
      saved = Number(localStorage.getItem('brassmoor.brightness')) || 0;
    } catch {
      saved = 0;
    }
    this.setBrightness(saved);
    const btn = document.getElementById('brightness');
    btn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleBrightness();
    });

    this.state = 'title';
    this.hud.setScreen('title');
    this.resetRun();
  }

  setBrightness(index) {
    const i = ((index % this.brightnessLevels.length) + this.brightnessLevels.length) % this.brightnessLevels.length;
    this.brightness = i;
    this.renderer.toneMappingExposure = this.brightnessLevels[i].exposure;
    const btn = document.getElementById('brightness');
    if (btn) btn.textContent = `☀ ${this.brightnessLevels[i].name}`;
    try {
      localStorage.setItem('brassmoor.brightness', String(i));
    } catch {
      /* storage unavailable (private mode): setting just won't persist */
    }
  }

  cycleBrightness() {
    this.setBrightness(this.brightness + 1);
  }

  // ---------- Run / wave flow ----------

  resetRun() {
    for (const t of this.traps) t.dispose();
    this.traps = [];
    for (const n of this.intruders) this.scene.remove(n.mesh);
    this.intruders = [];
    this.hud.clearWorld();
    this.player.reset();
    this.cogs = this.night.startingCogs;
    this.notes.read.clear();
    this.score = 0;
    this.kills = 0;
    this.bestCombo = 0;
    this.waveIndex = 0;
    this.spawnQueue = [];
    this.endTimer = 0;
  }

  // The overlay that currently owns input (dialogue, cutscene, note), if any.
  get modal() {
    if (this.cutscene.active) return this.cutscene;
    if (this.dialogue.active) return this.dialogue;
    if (this.notes.active) return this.notes;
    return null;
  }

  say(lines) {
    return this.dialogue.play(lines);
  }

  // Begin the night. The intro cutscene and opening scene play only the first
  // time; retrying after a defeat goes straight back to setup.
  async startRun() {
    this.resetRun();
    this.hud.setScreen(null);
    this.state = 'story';
    if (!this.introSeen) {
      this.introSeen = true;
      await this.cutscene.play(this.night.intro);
      await this.say(this.night.opening);
    }
    this.enterSetup();
  }

  async finishNight() {
    this.state = 'story';
    await this.cutscene.play(this.night.outro);
    await this.say(this.night.closing);
    this.state = 'victory';
    this.hud.setScreen('victory', this);
  }

  readNearbyNote() {
    if (this.state !== 'setup' || this.modal || !this.nearNote) return;
    this.notes.open(this.nearNote);
  }

  bark(intruder, kind) {
    const pool = BARKS[kind]?.[intruder.type] ?? BARKS[kind]?.any;
    if (!pool || intruder.def.named) return;
    if ((intruder.barkCooldown ?? 0) > this.time) return;
    intruder.barkCooldown = this.time + 4;
    this.hud.speech(intruder, pool[Math.floor(Math.random() * pool.length)]);
  }

  enterSetup() {
    this.state = 'setup';
    this.touchTarget = null;
    this.hud.setScreen(null);
    for (const t of this.traps) t.resetNow();
    this.hud.banner(`<b>Wave ${this.waveIndex + 1}</b><br>Set your traps`, 2.5);
  }

  startWave() {
    if (this.state !== 'setup') return;
    this.state = 'wave';
    this.setGhost(null);
    const w = this.night.waves[this.waveIndex];
    this.spawnQueue = w.intruders.map(([type, door], k) => ({ type, door, at: this.time + 0.5 + k * w.spacing }));
    this.endTimer = 0;
    const doors = [...new Set(w.intruders.map(([, d]) => d))];
    const names = w.intruders.map(([t]) => INTRUDERS[t].name);
    this.hud.banner(`<b>Intruders!</b><br>${names.join(', ')}<br><small>from the ${doors.join(' and ')} door${doors.length > 1 ? 's' : ''}</small>`, 3);
    if (w.onStart) this.say(w.onStart);
  }

  aliveCount() {
    return this.intruders.filter((n) => n.alive).length + this.spawnQueue.length;
  }

  // ---------- Callbacks from intruders / traps ----------

  onHit(intruder, source, dmg, mult) {
    const p = intruder.pos;
    this.fx.sparks({ x: p.x, y: p.y + 1.1 * intruder.def.scale, z: p.z }, 10 + intruder.combo.count * 4);
    if (['Iron Weight', 'Wall Slam', 'Hard Landing'].includes(source)) this.fx.dust(p, 18, 1.2);
    // Hit-stop: a tiny freeze that grows with the chain, capped so it never drags.
    this.freeze = Math.max(this.freeze, Math.min(0.05 + intruder.combo.count * 0.02, 0.12));
    if (Math.random() < 0.35) this.bark(intruder, 'hit');
    const cls = mult > 1 ? 'combo' : '';
    this.hud.floatText(intruder.pos, `${dmg}`, cls);
    this.hud.showCombo(intruder.combo.chain, intruder.combo.nextMultiplier());
    this.bestCombo = Math.max(this.bestCombo, intruder.combo.count);
    this.audio.play(intruder.combo.count > 1 ? 'combo' : 'hit');
  }

  onComboEnd(intruder, summary) {
    this.score += summary.score;
    if (summary.hits >= 2) this.hud.showCombo(summary.chain, 0, summary.score);
  }

  onKill(intruder, summary) {
    this.kills++;
    this.cogs += intruder.def.reward;
    this.score += intruder.def.score + (summary ? summary.score : 0);
    if (summary && summary.hits >= 2) this.hud.showCombo(summary.chain, 0, summary.score);
    this.hud.floatText(intruder.pos, `+${intruder.def.reward}⚙`, 'cogs');
    this.fx.defeat(intruder.pos);
    this.shake(0.2);
  }

  onIntruderAttack(intruder) {
    if (this.player.hurt(intruder.def.damage)) {
      this.hud.flashHurt();
      this.audio.play('hurt');
      this.shake(0.25);
    }
  }

  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  // ---------- Traps ----------

  trapAt(i, j, category) {
    return this.traps.find((t) => t.i === i && t.j === j && t.category === category);
  }

  canPlace(type, i, j) {
    if (!isWalkable(i, j)) return 'Aim at the floor';
    if (isDoorTile(i, j)) return "Can't build in an entrance";
    const def = TRAPS[type];
    if (allowedDirs(type, i, j).length === 0) return 'Rams must go next to a wall';
    if (this.trapAt(i, j, def.category)) return `A ${CATEGORIES[def.category].label.toLowerCase()} trap is already here`;
    if (def.cost > this.cogs) return 'Not enough cogs';
    return null;
  }

  currentDir(type, i, j) {
    const dirs = allowedDirs(type, i, j);
    if (!dirs.length) return { x: 0, z: 1 };
    return dirs[this.dirIndex % dirs.length];
  }

  placeTrap(type, i, j, dir = this.currentDir(type, i, j)) {
    const why = this.canPlace(type, i, j);
    if (why) return why;
    this.cogs -= TRAPS[type].cost;
    this.traps.push(new Trap(this.scene, type, i, j, dir));
    this.audio.play('place');
    return null;
  }

  sellTrapAt(i, j) {
    // Sell the trap matching the selected category first, else any trap on the tile.
    const cat = TRAPS[this.selectedType].category;
    const t = this.trapAt(i, j, cat) || this.traps.find((x) => x.i === i && x.j === j);
    if (!t) return false;
    this.cogs += Math.round(t.def.cost * SELL_REFUND);
    t.dispose();
    this.traps = this.traps.filter((x) => x !== t);
    return true;
  }

  categoryStatus(cat) {
    const list = this.traps.filter((t) => t.category === cat);
    return {
      total: list.length,
      ready: list.filter((t) => t.ready).length,
      armed: list.filter((t) => t.ready && t.targetsIn(this.intruders).length).length,
    };
  }

  // Fire every ready trap of a category that has an intruder in its zone.
  trigger(cat) {
    let fired = 0;
    for (const t of this.traps) {
      if (t.category === cat && t.ready && t.targetsIn(this.intruders).length) {
        if (t.fire(this)) fired++;
      }
    }
    if (!fired) this.audio.play('deny');
    return fired;
  }

  setGhost(type) {
    if (this.ghostType === type) return;
    if (this.ghost) this.scene.remove(this.ghost.group);
    this.ghost = type ? makeGhost(type) : null;
    this.ghostType = type;
    if (this.ghost) this.scene.add(this.ghost.group);
  }

  // Floor tile under a screen point in normalized device coords (-1..1), or null.
  tileAtScreen(ndcX, ndcY) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, hit)) return null;
    const t = worldToTile(hit.x, hit.z);
    return isWalkable(t.i, t.j) ? t : null;
  }

  // Touch: tapping the view selects the tile that Place / Sell act on.
  selectTileAtScreen(ndcX, ndcY) {
    if (this.state !== 'setup') return;
    const t = this.tileAtScreen(ndcX, ndcY);
    if (t) this.touchTarget = t;
  }

  updateBuild() {
    const input = this.input;
    TRAP_ORDER.forEach((type, idx) => {
      if (input.wasPressed(String(idx + 1))) this.selectedType = type;
    });
    if (input.wasPressed('Tab')) {
      const k = TRAP_ORDER.indexOf(this.selectedType);
      this.selectedType = TRAP_ORDER[(k + 1) % TRAP_ORDER.length];
    }
    if (input.wasPressed('r')) this.dirIndex++;

    // On touch screens a tapped tile wins; otherwise use the crosshair ray.
    let tile = this.touchTarget || this.tileAtScreen(0, 0);
    this.target = tile;

    this.setGhost(this.selectedType);
    const type = this.selectedType;
    for (const m of this.zoneMeshes) m.visible = false;
    if (!tile) {
      this.ghost.group.visible = false;
      this.placementHint = this.touchMode ? 'Tap a floor tile to select it' : 'Aim the crosshair at a floor tile';
      return;
    }
    const why = this.canPlace(type, tile.i, tile.j);
    const dir = this.currentDir(type, tile.i, tile.j);
    this.ghost.group.visible = true;
    tileCenter(tile.i, tile.j, this.ghost.group.position);
    this.ghost.group.rotation.y = dirAngle(dir);

    // Preview the zone using a throwaway Trap-shaped object.
    const zone = Trap.prototype.zoneTiles.call({ type, i: tile.i, j: tile.j, dir, def: TRAPS[type] });
    zone.forEach((z, k) => {
      const m = this.zoneMeshes[k];
      if (!m) return;
      m.visible = true;
      tileCenter(z.i, z.j, m.position);
      m.position.y = 0.03;
      m.material.color.setHex(why ? 0xff4040 : 0x40ff60);
    });

    if (this.touchMode) {
      this.placementHint = why ? `✖ ${why}` : 'Tap a tile, then Place · ↻ rotates';
    } else {
      this.placementHint = why
        ? `✖ ${why}. Right-click: sell`
        : 'Click: place · R: rotate · Right-click: sell · Enter: start wave';
    }

    for (const b of input.clicks) {
      if (b === 0) {
        if (this.placeTrap(type, tile.i, tile.j, dir)) this.audio.play('deny');
      } else if (b === 2) {
        this.sellTrapAt(tile.i, tile.j);
      }
    }
  }

  // ---------- Main update ----------
  // Per rendered frame: beginFrame -> step() at a fixed rate (1..n times) -> endFrame.
  // Fixed-step simulation keeps knockback distances identical at any frame rate.

  beginFrame(frameDt) {
    this.cam.look(frameDt, this.input);
  }

  endFrame(frameDt) {
    this.dt = frameDt;
    this.room.update(this.time);
    this.notes.animate(this.time);
    if (!this.modal) this.fx.update(frameDt);
    this.cam.follow(frameDt, this.focus ? this.focus.pos : this.player.pos);
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - frameDt * 1.5);
    }
    this.hud.update(this);
  }

  step(dt) {
    const input = this.input;
    if (input.wasPressed('b')) this.cycleBrightness();

    // Story overlays pause everything and take the input.
    const modal = this.modal;
    if (modal) {
      modal.update(dt, input);
      this.setGhost(null);
      for (const m of this.zoneMeshes) m.visible = false;
      return;
    }
    if (this.state === 'story') return;

    // During hit-stop the world holds still; input (trap triggers) still registers.
    const frozen = this.freeze > 0;
    if (frozen) this.freeze = Math.max(0, this.freeze - dt);
    else this.time += dt;

    if (this.state === 'title' || this.state === 'victory' || this.state === 'defeat') {
      // Consume the key so the same press doesn't also start wave 1 below.
      if (input.wasPressed('Enter')) {
        input.pressed.delete('Enter');
        this.startRun();
      }
    }

    if ((this.state === 'setup' || this.state === 'wave') && !frozen) {
      this.player.update(dt, input, this.cam.yaw);
    }

    if (this.state === 'setup') {
      this.updateBuild();
      this.nearNote = this.notes.nearest(this.player.pos);
      if (input.wasPressed('f')) this.readNearbyNote();
      if (input.wasPressed('Enter')) this.startWave();
    } else {
      this.nearNote = null;
      this.setGhost(null);
      for (const m of this.zoneMeshes) m.visible = false;
    }

    if (this.state === 'wave') {
      for (const [cat, c] of Object.entries(CATEGORIES)) {
        if (input.wasPressed(c.key)) this.trigger(cat);
      }
      // Spawns.
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
        const s = this.spawnQueue.shift();
        const door = DOORS[s.door];
        const p = tileCenter(door.i, door.j);
        // Nudge sideways along the wall so simultaneous spawns don't overlap.
        p.x += (Math.random() - 0.5) * 0.6 * Math.abs(door.side.z);
        p.z += (Math.random() - 0.5) * 0.6 * Math.abs(door.side.x);
        const n = new Intruder(this.scene, s.type, p);
        n.facing = Math.atan2(-door.side.x, -door.side.z);
        this.intruders.push(n);
        const entrance = this.night.waves[this.waveIndex].onSpawn?.[s.type];
        if (entrance) {
          this.hud.banner(`<b>${INTRUDERS[s.type].name}</b>`, 2.5);
          // Swing the camera over to the newcomer while they speak.
          this.focus = n;
          this.say(entrance).then(() => (this.focus = null));
          break; // the rest of the queue waits until the scene is over
        } else {
          setTimeout(() => this.bark(n, 'enter'), 900);
        }
      }
    }

    if (!frozen) {
      this.updateFlow(dt);
      for (const t of this.traps) t.update(dt, this);
      for (const n of this.intruders) n.update(dt, this);
      this.separate();
      this.intruders = this.intruders.filter((n) => !n.removed);
    }

    if (this.state === 'wave') {
      if (this.player.dead) {
        this.endTimer += dt;
        if (this.endTimer > 1.5) {
          this.state = 'defeat';
          this.hud.setScreen('defeat', this);
        }
      } else if (this.aliveCount() === 0) {
        this.endTimer += dt;
        if (this.endTimer > 1.5) {
          const cleared = this.night.waves[this.waveIndex];
          this.waveIndex++;
          this.player.heal(30);
          if (this.waveIndex >= this.night.waves.length) {
            this.finishNight();
          } else if (cleared.onClear) {
            this.state = 'story';
            this.say(cleared.onClear).then(() => this.enterSetup());
          } else {
            this.enterSetup();
          }
        }
      }
    }

  }

  // Where an intruder should walk: at the Keeper if in sight, else the next tile on the path.
  chaseTarget(n) {
    const P = this.player.pos;
    if (lineOfSight(n.pos, P)) return P;
    if (!this.flow) return P;
    const t = worldToTile(n.pos.x, n.pos.z);
    const next = nextStep(this.flow, t.i, t.j);
    if (!next) return P;
    const c = tileCenter(next.i, next.j);
    return new THREE.Vector3(c.x, 0, c.z);
  }

  updateFlow(dt) {
    const t = worldToTile(this.player.pos.x, this.player.pos.z);
    this.flowTimer = (this.flowTimer ?? 0) - dt;
    if (!this.flow || this.flowTimer <= 0 || t.i !== this.flowTile?.i || t.j !== this.flowTile?.j) {
      this.flow = flowField(t);
      this.flowTile = t;
      this.flowTimer = 0.5;
    }
  }

  // Keep bodies from overlapping each other and the player.
  separate() {
    const bodies = this.intruders.filter((n) => n.alive && n.state !== 'restrained');
    for (let a = 0; a < bodies.length; a++) {
      for (let b = a + 1; b < bodies.length; b++) {
        const A = bodies[a];
        const B = bodies[b];
        const dx = B.pos.x - A.pos.x;
        const dz = B.pos.z - A.pos.z;
        const d = Math.hypot(dx, dz);
        const min = A.def.radius * A.def.scale + B.def.radius * B.def.scale;
        if (d > 0.0001 && d < min) {
          const push = (min - d) / 2;
          A.pos.x -= (dx / d) * push;
          A.pos.z -= (dz / d) * push;
          B.pos.x += (dx / d) * push;
          B.pos.z += (dz / d) * push;
        }
      }
    }
    const P = this.player;
    for (const n of bodies) {
      const dx = n.pos.x - P.pos.x;
      const dz = n.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz);
      const min = n.def.radius * n.def.scale + 0.45;
      if (d > 0.0001 && d < min) {
        n.pos.x += (dx / d) * (min - d);
        n.pos.z += (dz / d) * (min - d);
      }
    }
  }
}
