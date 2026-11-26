// Renders the level map: floors per area, generated walls, doors and lighting.
import * as THREE from 'three';
import { TILE, WALL_H } from './config.js';
import { W, D, AREAS, areaAt, isWalkable, tileCenter, wallSegments, HALF_W, HALF_D } from './level.js';

function stoneTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#6e655d';
  g.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 900; n++) {
    const v = 90 + Math.floor(rnd() * 35);
    g.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`;
    g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  g.strokeStyle = 'rgba(40,32,28,0.9)';
  g.lineWidth = 4;
  g.strokeRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function brickTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3d332e';
  g.fillRect(0, 0, 256, 128);
  const bh = 32;
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 32 : 0;
    for (let x = -64; x < 256; x += 64) {
      const v = 100 + Math.floor(rnd() * 28);
      g.fillStyle = `rgb(${v},${v - 12},${v - 18})`;
      g.fillRect(x + off + 2, row * bh + 2, 60, bh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.5, WALL_H / 2);
  return tex;
}

export class Room {
  constructor(scene) {
    this.scene = scene;
    this.candles = [];
    this.build();
  }

  build() {
    const { scene } = this;

    // Floors: two alternating stone shades, tinted per area.
    const texA = stoneTexture(7);
    const texB = stoneTexture(91);
    const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.2, TILE * 0.98);
    const mats = {};
    for (const [key, a] of Object.entries(AREAS)) {
      const tint = new THREE.Color(a.floor);
      mats[key] = [
        new THREE.MeshStandardMaterial({ map: texA, roughness: 0.9, color: tint }),
        new THREE.MeshStandardMaterial({ map: texB, roughness: 0.9, color: tint.clone().multiplyScalar(0.85) }),
      ];
    }
    for (let j = 0; j < D; j++) {
      for (let i = 0; i < W; i++) {
        const a = areaAt(i, j);
        if (!a) continue;
        const m = new THREE.Mesh(tileGeo, mats[a][(i + j) % 2]);
        tileCenter(i, j, m.position);
        m.position.y = -0.1;
        m.receiveShadow = true;
        scene.add(m);
      }
    }
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2),
      new THREE.MeshStandardMaterial({ color: 0x0d0a09 })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.15;
    scene.add(under);

    // Walls: one slab per tile edge facing stone; doors get a lintel and a dark passage.
    const wallMat = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 });
    const t = 0.6;
    const slabCache = new Map();
    const slab = (alongZ, len) => {
      const key = `${alongZ}:${len.toFixed(2)}`;
      if (!slabCache.has(key)) {
        slabCache.set(key, alongZ ? new THREE.BoxGeometry(t, WALL_H, len) : new THREE.BoxGeometry(len, WALL_H, t));
      }
      return slabCache.get(key);
    };
    const lintelX = new THREE.BoxGeometry(t, WALL_H - 3, TILE);
    const lintelZ = new THREE.BoxGeometry(TILE, WALL_H - 3, t);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x050303 });
    for (const seg of wallSegments()) {
      const c = tileCenter(seg.i, seg.j);
      const alongZ = seg.side.x !== 0;
      const x = c.x + seg.side.x * (TILE / 2 + t / 2);
      const z = c.z + seg.side.z * (TILE / 2 + t / 2);
      if (seg.door) {
        const l = new THREE.Mesh(alongZ ? lintelX : lintelZ, wallMat);
        l.position.set(x, 3 + (WALL_H - 3) / 2, z);
        scene.add(l);
        const passage = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 3 : TILE, 3, alongZ ? TILE : 3), voidMat);
        passage.position.set(x + seg.side.x * 1.8, 1.5, z + seg.side.z * 1.8);
        scene.add(passage);
        continue;
      }
      // Slabs overlap at corners to hide seams, but must not poke into an opening.
      const tan = alongZ ? { x: 0, z: 1 } : { x: 1, z: 0 };
      const endExt = (d) => (isWalkable(seg.i + seg.side.x + tan.x * d, seg.j + seg.side.z + tan.z * d) ? 0 : t / 2);
      const extNeg = endExt(-1);
      const extPos = endExt(1);
      const m = new THREE.Mesh(slab(alongZ, TILE + extNeg + extPos), wallMat);
      const shift = (extPos - extNeg) / 2;
      m.position.set(x + tan.x * shift, WALL_H / 2, z + tan.z * shift);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }

    // Lighting: cold moonlight overall, warm or cool lamps per area.
    scene.add(new THREE.HemisphereLight(0x8090c0, 0x4a3a2e, 1.1));
    scene.add(new THREE.AmbientLight(0xffe8d0, 0.2));
    const moon = new THREE.DirectionalLight(0xb4c4ff, 1.3);
    moon.position.set(8, 22, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(4096, 2048);
    const sc = moon.shadow.camera;
    sc.left = -HALF_W - 4;
    sc.right = HALF_W + 4;
    sc.bottom = -HALF_D - 6;
    sc.top = HALF_D + 6;
    sc.near = 1;
    sc.far = 50;
    moon.shadow.bias = -0.0005;
    scene.add(moon);
    this.moon = moon;

    for (const [key, area] of Object.entries(AREAS)) {
      const tiles = [];
      for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) if (areaAt(i, j) === key) tiles.push({ i, j });
      const minI = Math.min(...tiles.map((p) => p.i));
      const maxI = Math.max(...tiles.map((p) => p.i));
      const small = tiles.length < 6;
      const spots = small ? [(minI + maxI) / 2] : [minI + (maxI - minI) * 0.25, minI + (maxI - minI) * 0.75];
      const midJ = tiles.reduce((s, p) => s + p.j, 0) / tiles.length;
      for (const si of spots) {
        const p = tileCenter(si, midJ);
        const base = small ? 18 : 36;
        const light = new THREE.PointLight(area.light, base, small ? 11 : 20, 1.2);
        light.position.set(p.x, 3.4, p.z);
        scene.add(light);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: area.light, emissiveIntensity: 2.5 })
        );
        lamp.position.copy(light.position);
        scene.add(lamp);
        const chain = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 3),
          new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        chain.position.set(p.x, 3.4 + 1.5, p.z);
        scene.add(chain);
        this.candles.push({ light, base, phase: Math.random() * 10 });
      }
    }
  }

  update(time) {
    for (const c of this.candles) {
      c.light.intensity =
        c.base * (0.85 + 0.1 * Math.sin(time * 9 + c.phase) + 0.05 * Math.sin(time * 23 + c.phase * 2));
    }
  }
}
