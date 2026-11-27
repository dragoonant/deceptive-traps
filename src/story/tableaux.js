// 3D tableaux for comic-panel cutscenes. Each builder fills a fresh scene and
// returns a camera. Rendered once to an image by studio.snapshot().
import * as THREE from 'three';
import { buildHumanoid } from '../characters.js';
import { makeGear } from '../props.js';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...opts });
const glowM = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

function add(scene, geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

function sky(scene, top, bottom, fog = null) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  if (fog) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
}

function moor(scene, color = 0x2a2a22) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 40, 40), M(color));
  const pos = ground.geometry.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin(pos.getX(k) * 0.07) * 1.2 + Math.cos(pos.getY(k) * 0.05) * 1.5);
  ground.geometry.computeVertexNormals();
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Dead trees and stones scattered on the heath.
  for (let k = 0; k < 14; k++) {
    const x = (Math.sin(k * 12.9) * 0.5 + 0.5) * 120 - 60;
    const z = -10 - (Math.cos(k * 7.3) * 0.5 + 0.5) * 80;
    if (Math.abs(x) < 6) continue;
    const trunk = add(scene, new THREE.CylinderGeometry(0.15, 0.3, 4, 5), M(0x1a1612), x, 2, z);
    const branch = add(scene, new THREE.CylinderGeometry(0.06, 0.12, 2, 4), M(0x1a1612), x + 0.6, 3.4, z);
    branch.rotation.z = -0.8;
    void trunk;
  }
}

// The manor seen from the moor road.
function manor(scene, x = 0, z = -40, litWindows = true) {
  const brick = M(0x3a2e2a);
  const roof = M(0x1e1a1e);
  const win = litWindows ? glowM(0xffb050, 2.2) : M(0x101018);
  add(scene, new THREE.BoxGeometry(26, 10, 10), brick, x, 5, z);
  add(scene, new THREE.BoxGeometry(9, 14, 9), brick, x, 7, z + 1);
  const r1 = add(scene, new THREE.ConeGeometry(15, 6, 4), roof, x, 13, z, Math.PI / 4);
  r1.scale.z = 0.45;
  add(scene, new THREE.ConeGeometry(7, 7, 4), roof, x, 17.5, z + 1, Math.PI / 4);
  // Clock tower.
  add(scene, new THREE.BoxGeometry(4, 10, 4), brick, x + 10, 15, z - 1);
  add(scene, new THREE.ConeGeometry(3.4, 5, 4), roof, x + 10, 22.5, z - 1, Math.PI / 4);
  add(scene, new THREE.CircleGeometry(1.3, 16), glowM(0xf2e6c0, 1.2), x + 10, 17, z + 1.05);
  for (const [wx, wy] of [
    [-9, 4], [-5, 4], [5, 4], [9, 4], [-9, 8], [5, 8], [9, 8], [0, 9], [0, 12.5],
  ]) {
    add(scene, new THREE.PlaneGeometry(1.4, 2), win, x + wx, wy, z + 5.05 + (Math.abs(wx) < 4 ? 0.5 : 0));
  }
  add(scene, new THREE.BoxGeometry(3, 4, 0.3), M(0x2a1a10), x, 2, z + 5.6); // door
  if (litWindows) {
    const l = new THREE.PointLight(0xffa040, 40, 30);
    l.position.set(x, 6, z + 9);
    scene.add(l);
  }
}

function moon(scene, x, y, z, r = 4) {
  add(scene, new THREE.SphereGeometry(r, 16, 12), glowM(0xf2ecd8, 1.4), x, y, z);
  const d = new THREE.DirectionalLight(0xa8b8ff, 1.6);
  d.position.set(x, y, z);
  d.castShadow = true;
  scene.add(d);
}

function lanternBearer(scene, look, x, z, ry) {
  const lit = true;
  const h = buildHumanoid(look, 1);
  h.root.position.set(x, 0, z);
  h.root.rotation.y = ry;
  h.arms[1].rotation.x = -0.9;
  const lantern = new THREE.Group();
  lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), M(0x2a2420, { metalness: 0.5 })));
  if (lit) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glowM(0xffc060, 3));
    lantern.add(flame);
    const l = new THREE.PointLight(0xffa040, 6, 8);
    lantern.add(l);
  }
  lantern.position.y = -0.75;
  h.arms[1].add(lantern);
  scene.add(h.root);
  return h;
}

export const TABLEAUX = {
  // Night 1, panel 1: Brassmoor alone on the moor.
  manorOnMoor(scene) {
    sky(scene, '#0b1026', '#3a3a5a', [0x2a2c44, 30, 140]);
    moor(scene);
    manor(scene, 4, -55);
    moon(scene, -40, 45, -120, 7);
    scene.add(new THREE.HemisphereLight(0x5060a0, 0x1a1810, 0.8));
    const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
    cam.position.set(-6, 4, 10);
    cam.lookAt(4, 9, -55);
    return cam;
  },

  // Panel 2: Wren beside the framed indenture, candle in hand.
  wrenAndIndenture(scene) {
    scene.background = new THREE.Color(0x140e0c);
    scene.add(new THREE.HemisphereLight(0x504060, 0x201410, 0.6));
    add(scene, new THREE.PlaneGeometry(20, 20), M(0x3a2c24), 0, 0, 0).rotation.x = -Math.PI / 2;
    add(scene, new THREE.BoxGeometry(12, 6, 0.4), M(0x5a3a2c), 0, 3, -1.6);
    const frame = add(scene, new THREE.BoxGeometry(1.5, 2, 0.1), M(0xc9a046, { metalness: 0.8, roughness: 0.3 }), 0.9, 2.2, -1.35);
    void frame;
    add(scene, new THREE.PlaneGeometry(1.25, 1.75), M(0xe8dcc0, { emissive: 0x3a3020 }), 0.9, 2.2, -1.29);
    for (let k = 0; k < 7; k++) add(scene, new THREE.BoxGeometry(0.9 - (k % 3) * 0.15, 0.03, 0.01), M(0x3a2a1a), 0.9, 2.8 - k * 0.18, -1.28);
    add(scene, new THREE.CircleGeometry(0.12, 12), M(0x8a1a1a), 1.3, 1.5, -1.28); // wax seal
    const w = buildHumanoid('wren', 1);
    w.root.position.set(-0.4, 0, 0.2);
    w.root.rotation.y = 0.6;
    w.arms[1].rotation.x = -1.1;
    w.head.rotation.y = 0.4;
    const candle = new THREE.Group();
    candle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), M(0xf2ead8)));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), glowM(0xffc060, 3));
    flame.position.y = 0.18;
    candle.add(flame);
    const cl = new THREE.PointLight(0xffa040, 8, 6, 1.5);
    cl.position.y = 0.25;
    candle.add(cl);
    candle.position.set(0, -0.65, 0.1);
    w.arms[1].add(candle);
    scene.add(w.root);
    // Warm key light from the candle side so Wren's face reads.
    const key = new THREE.DirectionalLight(0xffc890, 1.6);
    key.position.set(-1.5, 2.6, 3.5);
    scene.add(key);
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    cam.position.set(-1.6, 1.9, 3.4);
    cam.lookAt(0.3, 1.8, -0.8);
    return cam;
  },

  // Panel 3: lanterns on the moor road.
  lanternsOnRoad(scene) {
    sky(scene, '#070a1a', '#262640', [0x1a1c30, 10, 90]);
    moor(scene, 0x22221c);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4, 200), M(0x3a3428));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.6, -60);
    scene.add(road);
    manor(scene, 0, -95);
    scene.add(new THREE.HemisphereLight(0x5060a0, 0x18140c, 1.0));
    const moonlight = new THREE.DirectionalLight(0x9fb0ff, 1.4);
    moonlight.position.set(-8, 12, 14);
    scene.add(moonlight);
    lanternBearer(scene, 'rook', 0.2, 2, Math.PI);
    lanternBearer(scene, 'thief', -1.4, 3.6, Math.PI + 0.2);
    lanternBearer(scene, 'thief', 1.5, 4.2, Math.PI - 0.2);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    cam.position.set(1.0, 1.75, 8.2);
    cam.lookAt(0, 1.9, -12);
    return cam;
  },

  // Panel 4: a speaking tube in the wall, glowing, gears turning behind.
  houseWakes(scene) {
    scene.background = new THREE.Color(0x120c08);
    scene.add(new THREE.HemisphereLight(0x403020, 0x100804, 0.4));
    add(scene, new THREE.BoxGeometry(10, 6, 0.4), M(0x4a2e22), 0, 1.6, -1);
    const brass = M(0xc9a046, { metalness: 0.85, roughness: 0.28 });
    const horn = add(scene, new THREE.CylinderGeometry(0.6, 0.12, 1.1, 14, 1, true), brass, 0, 1.6, -0.3);
    horn.rotation.x = Math.PI / 2;
    horn.material.side = THREE.DoubleSide;
    add(scene, new THREE.CircleGeometry(0.15, 12), glowM(0xffa030, 3), 0, 1.6, -0.84);
    const glow = new THREE.PointLight(0xff9a30, 12, 6);
    glow.position.set(0, 1.6, 0.6);
    scene.add(glow);
    const dark = M(0x6a5430, { metalness: 0.6, roughness: 0.5 });
    for (const [x, y, r] of [
      [-1.6, 2.3, 0.9], [1.5, 0.9, 0.7], [1.9, 2.6, 0.5], [-1.2, 0.5, 0.5],
    ]) {
      const g = makeGear(r, Math.round(8 + r * 6), 0.12, dark);
      g.position.set(x, y, -0.7);
      g.rotation.z = x;
      scene.add(g);
    }
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
    cam.position.set(0.5, 1.7, 3.2);
    cam.lookAt(0, 1.6, -0.5);
    return cam;
  },

  // Outro panel 1: dawn, Rook's crew limping home.
  dawnRetreat(scene) {
    sky(scene, '#5a6a9a', '#f0a070', [0xc08a70, 20, 150]);
    moor(scene, 0x4a4632);
    manor(scene, 0, -60, false);
    const sun = new THREE.DirectionalLight(0xffc090, 2.2);
    sun.position.set(40, 12, -60);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xa0b0e0, 0x403020, 1.4));
    const crew = [
      ['rook', 0.4, -4],
      ['thief', -1.6, -6],
      ['thief', 1.8, -7],
    ];
    for (const [look, x, z] of crew) {
      const h = buildHumanoid(look, 1);
      h.root.position.set(x, 0.4, z);
      h.root.rotation.y = 0.2;
      h.rig.rotation.z = 0.18; // limping
      h.arms[0].rotation.x = 0.6;
      h.legs[0].rotation.x = 0.4;
      scene.add(h.root);
    }
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    cam.position.set(2.6, 1.9, 0.8);
    cam.lookAt(-0.3, 1.1, -6);
    return cam;
  },

  // Outro panel 2: Garrick at the door with the writ.
  garrickWrit(scene) {
    sky(scene, '#6a78a8', '#e8b080');
    scene.add(new THREE.HemisphereLight(0xb0c0e8, 0x403020, 1.1));
    const sun = new THREE.DirectionalLight(0xffc8a0, 2);
    sun.position.set(6, 8, 6);
    sun.castShadow = true;
    scene.add(sun);
    add(scene, new THREE.PlaneGeometry(30, 30), M(0x4a4632), 0, 0, 0).rotation.x = -Math.PI / 2;
    add(scene, new THREE.BoxGeometry(12, 7, 0.6), M(0x4a3a32), 0, 3.5, -2);
    add(scene, new THREE.BoxGeometry(2.4, 3.6, 0.3), M(0x3a2214), 0, 1.8, -1.6);
    const paper = add(scene, new THREE.PlaneGeometry(0.7, 0.95), M(0xf2ead2, { emissive: 0x2a2418 }), 0.5, 2.2, -1.44);
    paper.rotation.z = 0.05;
    add(scene, new THREE.CircleGeometry(0.09, 10), M(0xa02020), 0.5, 1.85, -1.43);
    const g = buildHumanoid('garrick', 1.3);
    g.root.position.set(-1.2, 0, 0.6);
    g.root.rotation.y = 0.9;
    g.arms[1].rotation.x = -1.5; // pointing at the writ
    scene.add(g.root);
    const k = buildHumanoid('knight', 1.25);
    k.root.position.set(-3.2, 0, -0.2);
    k.root.rotation.y = 0.5;
    scene.add(k.root);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    cam.position.set(2.8, 2.2, 5.2);
    cam.lookAt(-0.6, 1.9, -0.8);
    return cam;
  },
};
