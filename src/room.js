import * as THREE from 'three';
import { TILE, GRID_W, GRID_D, WALL_H } from './config.js';

export const HALF_W = (GRID_W * TILE) / 2;
export const HALF_D = (GRID_D * TILE) / 2;
export const DOOR_TILE = { i: Math.floor(GRID_W / 2), j: 0 };

export function tileCenter(i, j, out = new THREE.Vector3()) {
  return out.set((i - (GRID_W - 1) / 2) * TILE, 0, (j - (GRID_D - 1) / 2) * TILE);
}

export function worldToTile(x, z) {
  const i = Math.floor((x + HALF_W) / TILE);
  const j = Math.floor((z + HALF_D) / TILE);
  return { i, j };
}

export function inGrid(i, j) {
  return i >= 0 && j >= 0 && i < GRID_W && j < GRID_D;
}

// Directions a wall trap on this tile could face (pointing into the room).
export function inwardDirs(i, j) {
  const dirs = [];
  if (i === 0) dirs.push({ x: 1, z: 0 });
  if (i === GRID_W - 1) dirs.push({ x: -1, z: 0 });
  if (j === 0) dirs.push({ x: 0, z: 1 });
  if (j === GRID_D - 1) dirs.push({ x: 0, z: -1 });
  return dirs;
}

function stoneTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#4a4440';
  g.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 900; n++) {
    const v = 55 + Math.floor(rnd() * 30);
    g.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`;
    g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  g.strokeStyle = 'rgba(20,16,14,0.9)';
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
  g.fillStyle = '#231d1b';
  g.fillRect(0, 0, 256, 128);
  const bh = 32;
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 32 : 0;
    for (let x = -64; x < 256; x += 64) {
      const v = 70 + Math.floor(Math.random() * 25);
      g.fillStyle = `rgb(${v},${v - 12},${v - 18})`;
      g.fillRect(x + off + 2, row * bh + 2, 60, bh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Room {
  constructor(scene) {
    this.scene = scene;
    this.tileMeshes = [];
    this.candles = [];
    this.build();
  }

  build() {
    const { scene } = this;

    // Floor tiles in two alternating stone shades.
    const texA = stoneTexture(7);
    const texB = stoneTexture(91);
    const tileGeo = new THREE.BoxGeometry(TILE * 0.98, 0.2, TILE * 0.98);
    const matA = new THREE.MeshStandardMaterial({ map: texA, roughness: 0.9 });
    const matB = new THREE.MeshStandardMaterial({ map: texB, roughness: 0.9, color: 0xd8cfc4 });
    for (let i = 0; i < GRID_W; i++) {
      for (let j = 0; j < GRID_D; j++) {
        const m = new THREE.Mesh(tileGeo, (i + j) % 2 ? matA : matB);
        tileCenter(i, j, m.position);
        m.position.y = -0.1;
        m.receiveShadow = true;
        scene.add(m);
        this.tileMeshes.push(m);
      }
    }
    // Grout underneath so gaps read as dark lines.
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2),
      new THREE.MeshStandardMaterial({ color: 0x0d0a09 })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.15;
    scene.add(under);

    // Walls, with a door gap in the north wall.
    const brick = brickTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.95 });
    const t = 0.6;
    const addWall = (w, d, x, z) => {
      const tex = brick.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(w, d) / 4, WALL_H / 2);
      const mat = wallMat.clone();
      mat.map = tex;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mat);
      m.position.set(x, WALL_H / 2, z);
      m.receiveShadow = true;
      m.castShadow = true;
      scene.add(m);
    };
    const doorX = tileCenter(DOOR_TILE.i, DOOR_TILE.j).x;
    const doorHalf = TILE / 2;
    const leftLen = doorX - doorHalf + HALF_W;
    const rightLen = HALF_W - (doorX + doorHalf);
    addWall(leftLen + t, t, -HALF_W + leftLen / 2 - t / 2, -HALF_D - t / 2);
    addWall(rightLen + t, t, HALF_W - rightLen / 2 + t / 2, -HALF_D - t / 2);
    addWall(HALF_W * 2 + t * 2, t, 0, HALF_D + t / 2);
    addWall(t, HALF_D * 2, -HALF_W - t / 2, 0);
    addWall(t, HALF_D * 2, HALF_W + t / 2, 0);
    // Door lintel and dark corridor behind it.
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(TILE, WALL_H - 3, t), wallMat);
    lintel.position.set(doorX, 3 + (WALL_H - 3) / 2, -HALF_D - t / 2);
    scene.add(lintel);
    const corridor = new THREE.Mesh(
      new THREE.BoxGeometry(TILE, 3, 4),
      new THREE.MeshBasicMaterial({ color: 0x050303, side: THREE.BackSide })
    );
    corridor.position.set(doorX, 1.5, -HALF_D - 2);
    scene.add(corridor);

    // Lighting: cold moonlight plus warm, flickering candles.
    scene.add(new THREE.HemisphereLight(0x4a5a80, 0x1a100a, 0.55));
    const moon = new THREE.DirectionalLight(0x9fb4ff, 0.9);
    moon.position.set(8, 18, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -14;
    sc.right = sc.top = 14;
    sc.near = 1;
    sc.far = 40;
    moon.shadow.bias = -0.0005;
    scene.add(moon);

    const candleSpots = [
      [-HALF_W + 0.5, -HALF_D * 0.5],
      [-HALF_W + 0.5, HALF_D * 0.5],
      [HALF_W - 0.5, -HALF_D * 0.5],
      [HALF_W - 0.5, HALF_D * 0.5],
      [0, HALF_D - 0.5],
    ];
    for (const [x, z] of candleSpots) {
      const light = new THREE.PointLight(0xffa24a, 18, 12, 1.6);
      light.position.set(x, 2.6, z);
      scene.add(light);
      const sconce = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9a3a, emissiveIntensity: 2 })
      );
      sconce.position.copy(light.position);
      scene.add(sconce);
      this.candles.push({ light, base: 18, phase: Math.random() * 10 });
    }
  }

  update(time) {
    for (const c of this.candles) {
      c.light.intensity =
        c.base * (0.85 + 0.1 * Math.sin(time * 9 + c.phase) + 0.05 * Math.sin(time * 23 + c.phase * 2));
    }
  }
}
