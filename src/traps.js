import * as THREE from 'three';
import { TRAPS, TILE, WALL_H } from './config.js';
import { tileCenter, worldToTile, isWalkable, inwardDirs } from './level.js';
import { makeGear } from './props.js';

const DIRS = [
  { x: 0, z: 1 },
  { x: 1, z: 0 },
  { x: 0, z: -1 },
  { x: -1, z: 0 },
];

export function dirAngle(d) {
  return Math.atan2(d.x, d.z);
}

// ---- Visual builders (also used for the placement ghost) ----

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.5, ...extra });
}

function arrow(color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.55);
  shape.lineTo(0.28, 0.15);
  shape.lineTo(0.1, 0.15);
  shape.lineTo(0.1, -0.35);
  shape.lineTo(-0.1, -0.35);
  shape.lineTo(-0.1, 0.15);
  shape.lineTo(-0.28, 0.15);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.PI; // shape +Y -> local +Z
  m.position.y = 0.13;
  return m;
}

function buildSpring(def) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.8, 0.08, TILE * 0.8), mat(0x3a3330));
  base.position.y = 0.04;
  g.add(base);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 20), mat(0xc0c0c0));
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 0.08;
  g.add(coil);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.7, 0.06, TILE * 0.7), mat(def.color));
  plate.position.y = 0.1;
  g.add(plate);
  const a = arrow(0xf0e6c8);
  plate.add(a);
  a.position.y = 0.04;
  const gear = makeGear(0.28, 9, 0.08);
  gear.rotation.x = -Math.PI / 2;
  gear.position.set(-TILE * 0.33, 0.1, -TILE * 0.33);
  g.add(gear);
  return { group: g, parts: { plate, gears: [gear] } };
}

function buildClamp(def) {
  const g = new THREE.Group();
  const ring = makeGear(0.68, 14, 0.1, mat(def.color));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  const jaws = [];
  for (let k = 0; k < 6; k++) {
    const pivot = new THREE.Group();
    const a = (k / 6) * Math.PI * 2;
    pivot.position.set(Math.sin(a) * 0.55, 0.06, Math.cos(a) * 0.55);
    pivot.rotation.y = a;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 4), mat(0xd9d4c7));
    tooth.position.y = 0.25;
    pivot.add(tooth);
    g.add(pivot);
    jaws.push(pivot);
  }
  return { group: g, parts: { jaws, gears: [ring] } };
}

function buildRam(def) {
  // Built facing +Z, back against the wall at local z = -TILE/2.
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.5), mat(0x3a3330));
  housing.position.set(0, 0.9, -TILE / 2 + 0.25);
  g.add(housing);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 10), mat(0xbfbfbf));
  rod.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.3), mat(def.color));
  const piston = new THREE.Group();
  piston.add(rod);
  rod.position.z = -0.5;
  piston.add(head);
  piston.position.set(0, 0.9, -TILE / 2 + 0.65);
  g.add(piston);
  const a = arrow(0xf0e6c8);
  g.add(a);
  const gears = [];
  for (const sx of [-1, 1]) {
    const gear = makeGear(0.32, 9, 0.08);
    gear.rotation.y = Math.PI / 2;
    gear.position.set(sx * 0.6, 0.9, -TILE / 2 + 0.25);
    g.add(gear);
    gears.push(gear);
  }
  return { group: g, parts: { piston, restZ: piston.position.z, gears } };
}

function buildPendulum(def) {
  // Swings along local Z (its knock direction).
  const g = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = WALL_H - 0.3;
  g.add(pivot);
  const len = WALL_H - 1.2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, len, 0.1), mat(0x555555));
  arm.position.y = -len / 2;
  pivot.add(arm);
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 0.06, 24),
    mat(def.color, { metalness: 0.8, roughness: 0.25 })
  );
  blade.rotation.z = Math.PI / 2; // disc lies in the swing (YZ) plane
  blade.position.y = -len;
  pivot.add(blade);
  pivot.rotation.x = 1.1; // resting, pulled back toward -Z
  const a = arrow(0xf0e6c8);
  g.add(a);
  const gear = makeGear(0.4, 10, 0.1);
  gear.rotation.y = Math.PI / 2;
  gear.position.set(0.12, WALL_H - 0.3, 0);
  g.add(gear);
  return { group: g, parts: { pivot, gears: [gear] } };
}

function buildWeight(def) {
  const g = new THREE.Group();
  const block = new THREE.Group();
  const iron = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.9, 8), mat(def.color, { roughness: 0.7 }));
  iron.position.y = 0.45;
  block.add(iron);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), mat(0x888888));
  ring.position.y = 1.0;
  block.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 4), mat(0x777777));
  chain.position.y = 4;
  block.add(chain);
  block.position.y = WALL_H - 1.1;
  g.add(block);
  // Floor marking so the drop zone is readable.
  const mark = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.75, 24),
    new THREE.MeshBasicMaterial({ color: 0x8a2020, transparent: true, opacity: 0.6 })
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = 0.02;
  g.add(mark);
  const pulley = makeGear(0.35, 10, 0.1);
  pulley.position.set(0, WALL_H + 0.1, 0);
  g.add(pulley);
  return { group: g, parts: { block, chain, restY: WALL_H - 1.1, gears: [pulley] } };
}

const BUILDERS = {
  spring: buildSpring,
  clamp: buildClamp,
  ram: buildRam,
  pendulum: buildPendulum,
  weight: buildWeight,
};

export function buildTrapVisual(type) {
  const v = BUILDERS[type](TRAPS[type]);
  v.group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return v;
}

export function makeGhost(type) {
  const v = buildTrapVisual(type);
  v.group.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.45;
      o.material.depthWrite = false;
      o.castShadow = false;
    }
  });
  return v;
}

// ---- Trap logic ----

export class Trap {
  constructor(scene, type, i, j, dir) {
    this.type = type;
    this.def = TRAPS[type];
    this.category = this.def.category;
    this.i = i;
    this.j = j;
    this.dir = dir;
    this.cooldown = 0;
    this.anim = 0; // seconds since fired, or -1 when idle
    this.firing = false;
    this.pendingHit = false;
    const v = buildTrapVisual(type);
    this.visual = v;
    this.group = v.group;
    tileCenter(i, j, this.group.position);
    this.group.rotation.y = dirAngle(dir);
    scene.add(this.group);
    this.scene = scene;

    // Status lamp: green = target in zone, amber = ready, red = resetting.
    this.lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    this.lamp.position.set(TILE * 0.42, 0.2, TILE * 0.42);
    this.group.add(this.lamp);
    this.lamp.rotation.y = -this.group.rotation.y;
  }

  dispose() {
    this.scene.remove(this.group);
  }

  get ready() {
    return this.cooldown <= 0 && !this.firing;
  }

  // Tiles this trap affects.
  zoneTiles() {
    const { i, j, dir } = this;
    if (this.type === 'ram') {
      const out = [];
      for (let k = 0; k < this.def.reach; k++) out.push({ i: i + dir.x * k, j: j + dir.z * k });
      return out.filter((t) => isWalkable(t.i, t.j));
    }
    if (this.type === 'pendulum') {
      return [
        { i: i - dir.x, j: j - dir.z },
        { i, j },
        { i: i + dir.x, j: j + dir.z },
      ].filter((t) => isWalkable(t.i, t.j));
    }
    return [{ i, j }];
  }

  targetsIn(intruders) {
    const zone = this.zoneTiles();
    return intruders.filter((n) => {
      if (!n.alive) return false;
      // Floor traps only catch grounded intruders; ceiling/wall traps hit airborne ones too.
      if (this.category === 'floor' && n.pos.y > 0.3) return false;
      if (this.type === 'ram' && n.pos.y > 2.2) return false;
      const t = worldToTile(n.pos.x, n.pos.z);
      return zone.some((z) => z.i === t.i && z.j === t.j);
    });
  }

  fire(game) {
    if (!this.ready) return false;
    this.firing = true;
    this.anim = 0;
    this.pendingHit = true;
    if (this.type === 'spring' || this.type === 'clamp' || this.type === 'ram') {
      // Instant traps resolve on the fire frame.
      this.resolveHit(game);
    }
    game.audio?.play(this.type);
    return true;
  }

  resolveHit(game) {
    if (!this.pendingHit) return;
    this.pendingHit = false;
    const d = this.def;
    const targets = this.targetsIn(game.intruders);
    const center = tileCenter(this.i, this.j);
    for (const n of targets) {
      switch (this.type) {
        case 'spring':
          n.takeHit(game, d.name, d.damage, this.knockVec());
          break;
        case 'clamp':
          n.takeHit(game, d.name, d.damage, null, { restrain: d.holdTime, anchor: center });
          break;
        case 'ram':
          n.takeHit(game, d.name, d.damage, this.knockVec());
          break;
        case 'pendulum':
          n.takeHit(game, d.name, d.damage, this.knockVec());
          break;
        case 'weight':
          if (n.pos.y < 1.5) n.takeHit(game, d.name, d.damage, null, { stun: d.stun });
          break;
      }
    }
    if (this.type === 'weight') {
      game.shake(0.35);
      game.fx?.dust(center, 20, 1.3);
    }
    if (this.type === 'spring') game.fx?.dust(center, 8, 0.6);
    if (this.type === 'ram') game.fx?.sparks({ x: center.x + this.dir.x * 1.5, y: 0.9, z: center.z + this.dir.z * 1.5 }, 8, 0xd0d8ff, 4);
  }

  knockVec() {
    const k = this.def.knock;
    return { x: this.dir.x * k.h, y: k.v, z: this.dir.z * k.h };
  }

  update(dt, game) {
    const p = this.visual.parts;
    if (this.firing) {
      this.anim += dt;
      const t = this.anim;
      switch (this.type) {
        case 'spring': {
          p.plate.position.y = 0.1 + Math.max(0, Math.sin(Math.min(t / 0.3, 1) * Math.PI)) * 0.7;
          if (t > 0.3) this.finishFire();
          break;
        }
        case 'clamp': {
          // Jaws snap shut fast; they reopen when the trap resets.
          for (const j of p.jaws) j.rotation.x = -Math.min(t / 0.08, 1) * 0.9;
          if (t > 0.1) this.finishFire();
          break;
        }
        case 'ram': {
          const ext = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.3) / 0.5);
          p.piston.position.z = p.restZ + ext * (this.def.reach * TILE - 0.9);
          if (t > 0.8) this.finishFire();
          break;
        }
        case 'pendulum': {
          // Swing from +1.1 rad (back) through 0 (bottom) to -1.1 (front).
          const swing = Math.min(t / 0.45, 1);
          p.pivot.rotation.x = 1.1 - swing * 2.2;
          if (swing >= 0.5) this.resolveHit(game);
          if (t > 0.45) this.finishFire();
          break;
        }
        case 'weight': {
          const dd = this.def.dropDelay;
          const k = Math.min(t / dd, 1);
          p.block.position.y = p.restY * (1 - k * k);
          if (k >= 1) {
            this.resolveHit(game);
            this.finishFire();
          }
          break;
        }
      }
    } else if (this.cooldown > 0) {
      this.cooldown -= dt;
      const r = 1 - Math.max(0, this.cooldown) / this.def.cooldown; // reset progress 0..1
      if (this.type === 'clamp') for (const j of p.jaws) j.rotation.x = -0.9 + r * 0.9;
      if (this.type === 'pendulum') p.pivot.rotation.x = -1.1 + r * 2.2;
      if (this.type === 'weight') p.block.position.y = p.restY * Math.min(1, Math.max(0, (r - 0.2) / 0.8));
    }

    // Gears whirr while the trap resets and tick over slowly when idle.
    if (p.gears) {
      const spin = this.firing ? 14 : this.cooldown > 0 ? 6 : 0.4;
      for (const g of p.gears) g.rotation.z += spin * dt;
    }

    let color = 0xffaa00;
    if (!this.ready) color = 0xff3030;
    else if (this.targetsIn(game.intruders).length) color = 0x40ff60;
    this.lamp.material.color.setHex(color);
  }

  finishFire() {
    this.firing = false;
    this.cooldown = this.def.cooldown;
  }

  // Put a trap back to idle (used between waves).
  resetNow() {
    this.firing = false;
    this.cooldown = 0;
    const p = this.visual.parts;
    if (this.type === 'clamp') for (const j of p.jaws) j.rotation.x = 0;
    if (this.type === 'pendulum') p.pivot.rotation.x = 1.1;
    if (this.type === 'weight') p.block.position.y = p.restY;
    if (this.type === 'ram') p.piston.position.z = p.restZ;
    if (this.type === 'spring') p.plate.position.y = 0.1;
  }
}

// Valid facing directions for a trap type on a tile ([] = cannot be placed).
export function allowedDirs(type, i, j) {
  if (type === 'ram') return inwardDirs(i, j);
  return DIRS;
}
