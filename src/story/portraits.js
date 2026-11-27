// Character portraits for dialogue, rendered from the in-game models.
import * as THREE from 'three';
import { buildHumanoid } from '../characters.js';
import { makeGear } from '../props.js';
import { snapshot, studioLights } from './studio.js';

export const SPEAKERS = {
  wren: { name: 'Wren', look: 'wren', bg: 0x2e2442, accent: '#b89cf0' },
  house: { name: 'The House', look: 'house', bg: 0x2a2014, accent: '#e0b44e' },
  rook: { name: 'Jessamy Rook', look: 'rook', bg: 0x1f2e1c, accent: '#e0574f', scale: 1.05 },
  pell: { name: 'Pell', look: 'thief', bg: 0x1f2e1c, accent: '#8fc07a' },
  marrow: { name: 'Marrow', look: 'thief', bg: 0x23301f, accent: '#8fc07a' },
  dunne: { name: 'Dunne', look: 'thief', bg: 0x1c2a22, accent: '#8fc07a' },
  garrick: { name: 'Sir Oswin Garrick', look: 'garrick', bg: 0x30181a, accent: '#e06a5a', scale: 1.3 },
  knight: { name: 'Guild Knight', look: 'knight', bg: 0x262a30, accent: '#c0c8d2', scale: 1.25 },
};

const cache = new Map();

// The House has no face: a brass speaking-tube horn with a glowing throat.
function buildHouse(scene) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a046, metalness: 0.85, roughness: 0.3, flatShading: true });
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.12, 0.9, 12, 1, true), brass);
  horn.material.side = THREE.DoubleSide;
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 1.6, 0.1);
  scene.add(horn);
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff8a20, emissiveIntensity: 2.5 })
  );
  throat.position.set(0, 1.6, -0.34);
  scene.add(throat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 20), brass);
  rim.position.set(0, 1.6, 0.55);
  scene.add(rim);
  for (let k = -2; k <= 2; k++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), brass);
    bar.position.set(k * 0.18, 1.6, 0.56);
    scene.add(bar);
  }
  const gear = makeGear(0.9, 14, 0.1, new THREE.MeshStandardMaterial({ color: 0x6a5430, metalness: 0.6, roughness: 0.5, flatShading: true }));
  gear.position.set(0.5, 1.9, -0.6);
  scene.add(gear);
  const gear2 = makeGear(0.5, 10, 0.1, gear.material);
  gear2.position.set(-0.75, 1.2, -0.55);
  scene.add(gear2);
  const glow = new THREE.PointLight(0xff9a30, 6, 4);
  glow.position.set(0, 1.6, 0.4);
  scene.add(glow);
}

export function portrait(speakerId) {
  if (cache.has(speakerId)) return cache.get(speakerId);
  const sp = SPEAKERS[speakerId];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sp.bg);
  studioLights(scene);
  const scale = sp.scale ?? 1;
  let headY = 1.62 * scale + 0.02;
  if (sp.look === 'house') {
    buildHouse(scene);
    headY = 1.6;
  } else {
    const h = buildHumanoid(sp.look, scale);
    h.root.rotation.y = -0.35; // three-quarter view
    h.arms[0].rotation.x = -0.15;
    scene.add(h.root);
  }
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  // Frame head and headwear (hats and plumes sit up to ~0.45 above the head).
  cam.position.set(0.3, headY + 0.12, 2.15 * Math.max(1, scale * 0.95));
  cam.lookAt(0, headY + 0.02, 0);
  const url = snapshot(scene, cam, 256, 256);
  cache.set(speakerId, url);
  return url;
}
