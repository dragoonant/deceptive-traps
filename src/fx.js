// Lightweight particle effects: one pooled Points system per blend mode,
// with per-particle size, colour and fade via a tiny custom shader.
import * as THREE from 'three';

const VERT = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    gl_FragColor = vec4(vTint, vAlpha * (1.0 - r * 3.2));
  }`;

class Pool {
  constructor(scene, max, blending) {
    this.max = max;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.tint = new Float32Array(max * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = geo;
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ life: o.life, age: 0, ...o });
  }

  update(dt) {
    const alive = [];
    for (const q of this.p) {
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= (q.gravity ?? 0) * dt;
      const drag = Math.pow(q.drag ?? 1, dt);
      q.vx *= drag;
      q.vy *= drag;
      q.vz *= drag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.y < 0.02 && q.bounce) {
        q.y = 0.02;
        q.vy = -q.vy * 0.4;
      }
      alive.push(q);
    }
    this.p = alive;
    let k = 0;
    for (const q of alive) {
      const t = q.age / q.life;
      this.pos[k * 3] = q.x;
      this.pos[k * 3 + 1] = q.y;
      this.pos[k * 3 + 2] = q.z;
      this.size[k] = q.size * (1 + (q.grow ?? 0) * t);
      this.alpha[k] = (q.alpha ?? 1) * (1 - t) * Math.min(1, q.age * 20);
      this.tint[k * 3] = q.r;
      this.tint[k * 3 + 1] = q.g;
      this.tint[k * 3 + 2] = q.b;
      k++;
    }
    for (let n = k; n < this.max; n++) this.alpha[n] = 0;
    this.geo.setDrawRange(0, Math.max(k, 1));
    for (const a of ['position', 'size', 'alpha', 'tint']) this.geo.attributes[a].needsUpdate = true;
  }
}

const rand = (a, b) => a + Math.random() * (b - a);
const rgb = (hex) => ({ r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 });

export class Fx {
  constructor(scene) {
    this.glow = new Pool(scene, 500, THREE.AdditiveBlending); // sparks, embers
    this.soft = new Pool(scene, 400, THREE.NormalBlending); // dust, steam
    this.emitters = [];
  }

  sparks(pos, count = 14, color = 0xffc060, speed = 6) {
    const c = rgb(color);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const up = rand(0.2, 1);
      const s = rand(0.4, 1) * speed;
      this.glow.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s * (1 - up * 0.5), vy: up * s, vz: Math.sin(a) * s * (1 - up * 0.5),
        gravity: 14, drag: 0.3, bounce: true,
        size: rand(0.12, 0.22), life: rand(0.35, 0.7), ...c,
      });
    }
  }

  dust(pos, count = 16, radius = 1, color = 0x9a8f80) {
    const c = rgb(color);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const s = rand(1.5, 3.5) * radius;
      this.soft.emit({
        x: pos.x + Math.cos(a) * 0.3, y: 0.15, z: pos.z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * s, vy: rand(0.3, 1.2), vz: Math.sin(a) * s,
        drag: 0.05, size: rand(0.5, 0.8), grow: 1.5, alpha: 0.55, life: rand(0.6, 1.0), ...c,
      });
    }
  }

  // Little brass gears and sparkles when an intruder is defeated.
  defeat(pos) {
    this.sparks({ x: pos.x, y: pos.y + 1, z: pos.z }, 22, 0xffd27a, 5);
    this.dust(pos, 12, 0.6, 0x7a7068);
  }

  // Continuous sources: furnace embers and boiler steam.
  addEmbers(pos) {
    this.emitters.push({ kind: 'embers', pos, t: 0 });
  }

  addSteam(pos) {
    this.emitters.push({ kind: 'steam', pos, t: Math.random() * 3 });
  }

  update(dt) {
    for (const e of this.emitters) {
      e.t += dt;
      if (e.kind === 'embers' && Math.random() < dt * 14) {
        this.glow.emit({
          x: e.pos.x + rand(-0.3, 0.3), y: e.pos.y, z: e.pos.z + rand(-0.4, 0.4),
          vx: rand(0.2, 0.9), vy: rand(0.8, 2.0), vz: rand(-0.3, 0.3),
          drag: 0.6, size: rand(0.06, 0.12), life: rand(0.8, 1.6), r: 1, g: rand(0.4, 0.7), b: 0.15,
        });
      }
      // Steam vents in short hissing bursts every few seconds.
      if (e.kind === 'steam' && e.t % 4 < 0.6 && Math.random() < dt * 30) {
        this.soft.emit({
          x: e.pos.x, y: e.pos.y, z: e.pos.z,
          vx: rand(-0.3, 0.3), vy: rand(1.2, 2.2), vz: rand(-0.3, 0.3),
          drag: 0.4, size: rand(0.3, 0.5), grow: 3, alpha: 0.35, life: rand(1.0, 1.6), r: 0.92, g: 0.92, b: 0.95,
        });
      }
    }
    this.glow.update(dt);
    this.soft.update(dt);
  }
}
