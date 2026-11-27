// Furniture and decoration for the manor, all built from primitives.
// Obstacles (solid tiles from level.js) and pure decor (wall-mounted or overhead).
import * as THREE from 'three';
import { TILE, WALL_H } from './config.js';
import { OBSTACLES, tileCenter } from './level.js';
import { buildHumanoid } from './characters.js';

const cache = new Map();
function mat(color, opts = {}) {
  const key = `${color}:${JSON.stringify(opts)}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...opts }));
  return cache.get(key);
}
const brass = () => mat(0xc9a046, { metalness: 0.8, roughness: 0.3 });
const iron = () => mat(0x4a4d52, { metalness: 0.6, roughness: 0.45 });
const copper = () => mat(0xb4683a, { metalness: 0.7, roughness: 0.35 });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Toothed gear lying in the XY plane, facing +Z.
export function makeGear(radius = 0.6, teeth = 10, depth = 0.12, material = brass()) {
  const shape = new THREE.Shape();
  const inner = radius * 0.82;
  for (let k = 0; k < teeth * 2; k++) {
    const a0 = (k / (teeth * 2)) * Math.PI * 2;
    const a1 = ((k + 1) / (teeth * 2)) * Math.PI * 2;
    const r = k % 2 === 0 ? radius : inner;
    if (k === 0) shape.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
    else shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    shape.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.3, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const g = new THREE.Mesh(geo, material);
  g.castShadow = true;
  return g;
}

// ---------- Painted canvases ----------

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PAINTINGS = {
  moor: (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b3a5c');
    sky.addColorStop(0.6, '#c07a4a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3324';
    g.beginPath();
    g.moveTo(0, h * 0.7);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.66 + Math.sin(x / 23) * 8);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = '#1e1a14';
    g.fillRect(w * 0.62, h * 0.42, w * 0.18, h * 0.26); // the manor, tiny
    g.beginPath();
    g.moveTo(w * 0.6, h * 0.43);
    g.lineTo(w * 0.71, h * 0.32);
    g.lineTo(w * 0.82, h * 0.43);
    g.fill();
  },
  portrait: (g, w, h, tint = '#5a2a2a') => {
    g.fillStyle = '#2a2420';
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w / 2, h * 0.4, 5, w / 2, h * 0.4, w * 0.7);
    glow.addColorStop(0, '#6a5a48');
    glow.addColorStop(1, '#1e1a16');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = tint;
    g.beginPath();
    g.ellipse(w / 2, h * 0.95, w * 0.42, h * 0.38, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d8b08a';
    g.beginPath();
    g.ellipse(w / 2, h * 0.42, w * 0.17, h * 0.15, 0, 0, Math.PI * 2);
    g.fill();
  },
  corvel: (g, w, h) => {
    PAINTINGS.portrait(g, w, h, '#2a3346');
    g.fillStyle = '#c9c2b4'; // grey hair
    g.beginPath();
    g.ellipse(w / 2, h * 0.32, w * 0.2, h * 0.08, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = '#e0b44e'; // brass monocle
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w * 0.56, h * 0.41, w * 0.05, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.6, h * 0.44);
    g.lineTo(w * 0.66, h * 0.62);
    g.stroke();
    g.fillStyle = '#e0b44e';
    g.font = `bold ${Math.round(h * 0.06)}px Georgia`;
    g.textAlign = 'center';
    g.fillText('L. CORVEL', w / 2, h * 0.93);
  },
  blueprint: (g, w, h) => {
    g.fillStyle = '#1f3d6a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,220,255,0.25)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 12) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += 12) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.strokeStyle = '#dfe9ff';
    g.lineWidth = 2;
    for (const [cx, cy, r] of [
      [w * 0.4, h * 0.5, w * 0.22],
      [w * 0.72, h * 0.36, w * 0.12],
    ]) {
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const rr = k % 2 ? r : r * 0.85;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.stroke();
    }
    g.fillStyle = '#dfe9ff';
    g.font = `${Math.round(h * 0.07)}px Georgia`;
    g.fillText('HEARTSPRING — II', w * 0.08, h * 0.92);
  },
  rug: (g, w, h) => {
    g.fillStyle = '#5a1e1e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a046';
    g.lineWidth = 10;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3;
    g.strokeRect(38, 38, w - 76, h - 76);
    g.fillStyle = '#7a2a2a';
    for (let y = 70; y < h - 60; y += 60) {
      g.beginPath();
      g.moveTo(w / 2, y);
      g.lineTo(w / 2 + 40, y + 30);
      g.lineTo(w / 2, y + 60);
      g.lineTo(w / 2 - 40, y + 30);
      g.fill();
    }
  },
};

function painting(kind, width, height) {
  const g = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.08), brass());
  g.add(frame);
  const tex = canvasTex(128, Math.round((128 * height) / width), PAINTINGS[kind]);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  canvas.position.z = 0.045;
  g.add(canvas);
  return g;
}

// Place an object flat against a tile's wall, facing into the room.
function onWall(obj, i, j, side, y, inset = 0.02) {
  const c = tileCenter(i, j);
  obj.position.set(c.x + side.x * (TILE / 2 - inset), y, c.z + side.z * (TILE / 2 - inset));
  obj.rotation.y = Math.atan2(-side.x, -side.z);
  return obj;
}

const N = { x: 0, z: -1 };
const S = { x: 0, z: 1 };
const E = { x: 1, z: 0 };
const Wd = { x: -1, z: 0 };

// ---------- Obstacles ----------

function boiler() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.8, 0.85, 2.4, 10), copper(), 0, 1.2, 0));
  g.add(mesh(new THREE.SphereGeometry(0.8, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), copper(), 0, 2.4, 0));
  for (const y of [0.4, 1.2, 2.0]) {
    const band = mesh(new THREE.TorusGeometry(0.84, 0.05, 4, 16), iron(), 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  // Steam valve on top (kept below OBSTACLE_H so the camera can pass over).
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 6), iron(), 0.3, 3.05, 0));
  const gauge = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), brass(), 0, 1.7, 0.84);
  gauge.rotation.x = Math.PI / 2;
  g.add(gauge);
  const face = mesh(new THREE.CircleGeometry(0.14, 12), mat(0xf2ead8, { emissive: 0x332a1a }), 0, 1.7, 0.875);
  g.add(face);
  const wheel = mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 10), mat(0xa02828), 0.55, 1.0, 0.62);
  wheel.rotation.y = 0.6;
  g.add(wheel);
  return { group: g };
}

function furnace() {
  const g = new THREE.Group();
  const brick = mat(0x6b3a2a);
  g.add(mesh(new THREE.BoxGeometry(1.8, 2.4, 1.6), brick, -0.1, 1.2, 0));
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.2, 1.8), iron(), -0.1, 2.5, 0));
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 2.2 });
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), glowMat);
  mouth.position.set(0.81, 0.85, 0);
  mouth.rotation.y = Math.PI / 2;
  g.add(mouth);
  for (let k = -1; k <= 1; k++) {
    const bar = mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), iron(), 0.84, 0.85, k * 0.25);
    g.add(bar);
  }
  // Flue runs up flush against the wall, out of the camera's way.
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, WALL_H - 2.6, 8), iron(), -0.78, 2.6 + (WALL_H - 2.6) / 2, 0));
  const light = new THREE.PointLight(0xff6a20, 14, 9, 1.4);
  light.position.set(1.4, 1.0, 0);
  g.add(light);
  return { group: g, flicker: { light, mat: glowMat, base: 14 } };
}

function pillar() {
  const g = new THREE.Group();
  const stone = mat(0x8a8178);
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.35, 1.3), stone, 0, 0.18, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.48, 0.52, WALL_H - 0.7, 10), stone, 0, WALL_H / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.35, 1.3), stone, 0, WALL_H - 0.18, 0));
  for (const y of [1.2, 3.2]) {
    const band = mesh(new THREE.TorusGeometry(0.52, 0.05, 4, 14), brass(), 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  return { group: g };
}

const STONE_LOOK = {
  coat: 0xc9c2b6,
  trim: 0xb0a99c,
  pants: 0xbab3a6,
  boots: 0xa8a194,
  skin: 0xd4cdc0,
  hair: 0xb8b1a4,
  hairStyle: 'bob',
  coatTails: true,
};

function statue() {
  const g = new THREE.Group();
  const marble = mat(0xd8d2c6);
  g.add(mesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), marble, 0, 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(1.45, 0.12, 1.45), brass(), 0, 1.0, 0));
  const fig = buildHumanoid(STONE_LOOK, 1.05);
  fig.root.position.y = 1.06;
  fig.arms[1].rotation.x = -2.4; // one arm raised, holding a gear aloft
  const gear = makeGear(0.28, 8, 0.06, mat(0xd8d2c6));
  gear.position.set(0, -0.72, 0);
  fig.arms[1].add(gear);
  g.add(fig.root);
  return { group: g };
}

const OBSTACLE_BUILDERS = { boiler, furnace, pillar, statue };

// ---------- Build everything ----------

export function buildProps(scene) {
  const animated = { gears: [], flickers: [] };

  for (const o of OBSTACLES) {
    const built = OBSTACLE_BUILDERS[o.type]();
    tileCenter(o.i, o.j, built.group.position);
    scene.add(built.group);
    if (built.flicker) animated.flickers.push(built.flicker);
  }

  // Grand Foyer: rug, chandelier, clock, portraits, a wall of machinery.
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 9),
    new THREE.MeshStandardMaterial({ map: canvasTex(128, 256, PAINTINGS.rug), roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  const rc = tileCenter(13, 3.5);
  rug.position.set(rc.x, 0.012, rc.z);
  rug.receiveShadow = true;
  scene.add(rug);

  const chand = new THREE.Group();
  const cc = tileCenter(13, 4);
  chand.position.set(cc.x, WALL_H - 0.9, cc.z);
  const ring = mesh(new THREE.TorusGeometry(0.9, 0.06, 5, 16), brass());
  ring.rotation.x = Math.PI / 2;
  chand.add(ring);
  chand.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), iron(), 0, 0.6, 0));
  const flame = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 2.5 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    chand.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 5), mat(0xf2ead8), Math.cos(a) * 0.9, 0.14, Math.sin(a) * 0.9));
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), flame);
    f.position.set(Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9);
    chand.add(f);
  }
  scene.add(chand);

  const clock = new THREE.Group();
  clock.add(mesh(new THREE.BoxGeometry(0.85, 2.6, 0.45), mat(0x4a2c1a), 0, 1.3, 0));
  clock.add(mesh(new THREE.BoxGeometry(0.95, 0.18, 0.5), mat(0x3a2214), 0, 2.65, 0));
  const dial = mesh(new THREE.CircleGeometry(0.3, 16), mat(0xf2ead8), 0, 2.15, 0.23);
  clock.add(dial);
  const hand = mesh(new THREE.BoxGeometry(0.03, 0.22, 0.01), mat(0x1a1410), 0, 2.22, 0.24);
  clock.add(hand);
  const pend = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), brass(), 0, 1.1, 0.23);
  pend.rotation.x = Math.PI / 2;
  clock.add(pend);
  onWall(clock, 10, 0, N, 0, 0.24);
  scene.add(clock);
  animated.clock = { hand, pend };

  scene.add(onWall(painting('portrait', 1.0, 1.3), 9, 1, Wd, 2.6));
  scene.add(onWall(painting('moor', 1.6, 1.0), 9, 7, Wd, 2.6));
  scene.add(onWall(painting('portrait', 1.0, 1.3), 17, 1, E, 2.6));
  scene.add(onWall(painting('moor', 1.6, 1.0), 17, 7, E, 2.6));

  // Wall machinery: big turning gears behind glass-less frames.
  const gearSpots = [
    [15, 0, N, 3.3, 1.0, 1],
    [16, 0, N, 2.2, 0.6, -1],
    [12, 8, S, 3.2, 0.9, 1],
    [7, 4, N, 2.8, 0.7, 1], // West Passage
    [8, 4, S, 3.0, 0.8, -1],
    [18, 4, N, 3.0, 0.8, 1], // East Passage
    [19, 4, S, 2.6, 0.6, -1],
  ];
  for (const [i, j, side, y, r, dir] of gearSpots) {
    const gear = makeGear(r, Math.round(8 + r * 6), 0.12);
    const holder = onWall(new THREE.Group(), i, j, side, y, 0.08);
    holder.add(gear);
    scene.add(holder);
    animated.gears.push({ gear, speed: (0.35 / r) * dir });
  }

  // Boiler Room: pipes along the walls and pressure gauges.
  for (const [j, side] of [
    [1, N],
    [7, S],
  ]) {
    const a = tileCenter(0, j);
    const b = tileCenter(6, j);
    const pipe = mesh(new THREE.CylinderGeometry(0.12, 0.12, b.x - a.x + TILE, 8), copper());
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set((a.x + b.x) / 2, 4.55, a.z + side.z * (TILE / 2 - 0.13));
    scene.add(pipe);
    for (let i = 1; i <= 5; i += 2) {
      const gauge = onWall(new THREE.Group(), i, j, side, 2.2, 0.06);
      const body = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), brass());
      body.rotation.x = Math.PI / 2;
      gauge.add(body);
      gauge.add(mesh(new THREE.CircleGeometry(0.12, 12), mat(0xf2ead8, { emissive: 0x2a2418 }), 0, 0, 0.035));
      scene.add(gauge);
    }
  }
  scene.add(onWall(painting('blueprint', 1.4, 1.0), 4, 1, N, 2.3));

  // Gallery: paintings, with Corvel's portrait in pride of place.
  scene.add(onWall(painting('corvel', 1.5, 2.0), 23, 7, S, 2.6));
  scene.add(onWall(painting('moor', 1.6, 1.0), 21, 7, S, 2.5));
  scene.add(onWall(painting('portrait', 1.0, 1.3), 25, 7, S, 2.5));
  scene.add(onWall(painting('moor', 1.6, 1.0), 21, 1, N, 2.5));
  scene.add(onWall(painting('portrait', 1.0, 1.3), 23, 1, N, 2.6));
  scene.add(onWall(painting('blueprint', 1.4, 1.0), 25, 1, N, 2.5));

  return animated;
}

export function updateProps(animated, time, dt) {
  for (const g of animated.gears) g.gear.rotation.z += g.speed * dt;
  for (const f of animated.flickers) {
    const k = 0.8 + 0.15 * Math.sin(time * 11) + 0.08 * Math.sin(time * 27 + 1.3);
    f.light.intensity = f.base * k;
    f.mat.emissiveIntensity = 2.2 * k;
  }
  if (animated.clock) {
    animated.clock.pend.position.x = Math.sin(time * 2.2) * 0.18;
    animated.clock.hand.rotation.z = -time * 0.05;
  }
}
