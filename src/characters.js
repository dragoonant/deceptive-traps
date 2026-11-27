import * as THREE from 'three';

// Stylized low-poly humanoids built from primitives, flat-shaded.
// Every character is a preset of the same rig so animation code is shared.

const mats = new Map();
function mat(color, opts = {}) {
  const key = `${color}:${JSON.stringify(opts)}`;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...opts }));
  }
  return mats.get(key);
}
const metal = (color) => mat(color, { metalness: 0.75, roughness: 0.35 });

export const LOOKS = {
  wren: {
    coat: 0x6a4aa0,
    trim: 0xe0b44e,
    pants: 0x2b2238,
    boots: 0x3a2a1e,
    skin: 0xe8c4a0,
    hair: 0x2a1a14,
    hairStyle: 'bob',
    goggles: true,
    coatTails: true,
  },
  thief: {
    coat: 0x4f7d3f,
    trim: 0x2f2418,
    pants: 0x3a3226,
    boots: 0x2a2018,
    skin: 0xd9ad85,
    hair: 0x4a3524,
    hood: 0x3f6633,
    mask: true,
    sack: true,
  },
  rook: {
    coat: 0x2f4a2a,
    trim: 0xb8912f,
    pants: 0x2a2620,
    boots: 0x1f1812,
    skin: 0xe2b896,
    hair: 0xa3381f,
    hairStyle: 'ponytail',
    scarf: 0xc4302b,
    hat: 'tricorn',
    coatTails: true,
  },
  knight: {
    armour: 0x9aa3ad,
    trim: 0x8c2f2f,
    tabard: 0x8c2f2f,
    pants: 0x4a4f55,
    boots: 0x3a3d42,
    skin: 0xd8b090,
    helmet: 'visor',
    shield: true,
  },
  garrick: {
    armour: 0xb8bec6,
    trim: 0xd4a84a,
    tabard: 0xa02828,
    pants: 0x4a4f55,
    boots: 0x2e3035,
    skin: 0xe0b494,
    hair: 0xcfc6b8,
    helmet: 'open',
    plume: 0xd83030,
    moustache: true,
    shield: true,
  },
};

// Returns { root, rig, torso, head, arms[2], legs[2], bodyMat }.
// bodyMat is a per-character material used for hit flashes.
export function buildHumanoid(lookOrName = 'thief', scale = 1) {
  const L = typeof lookOrName === 'string' ? LOOKS[lookOrName] : lookOrName;
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const armoured = !!L.armour;
  // Unique material for the torso so emissive hit flashes don't affect others.
  const bodyMat = armoured
    ? new THREE.MeshStandardMaterial({ color: L.armour, metalness: 0.7, roughness: 0.35, flatShading: true })
    : new THREE.MeshStandardMaterial({ color: L.coat, roughness: 0.8, flatShading: true });
  const trimMat = armoured ? metal(L.trim) : mat(L.trim);
  const skinMat = mat(L.skin);
  const pantsMat = mat(L.pants);
  const bootMat = mat(L.boots, { roughness: 0.6 });

  // Legs (pivot at the hip).
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.15, 0.78, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.62, 6), pantsMat);
    thigh.position.y = -0.31;
    hip.add(thigh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.3), bootMat);
    boot.position.set(0, -0.68, 0.05);
    hip.add(boot);
    rig.add(hip);
    legs.push(hip);
  }

  // Torso: tapered body plus a coat skirt or a tabard.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.62, 8), bodyMat);
  torso.position.y = 1.08;
  rig.add(torso);
  if (L.coatTails || !armoured) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, L.coatTails ? 0.4 : 0.33, 0.42, 8, 1, true), bodyMat);
    skirt.position.y = 0.6;
    rig.add(skirt);
  }
  if (L.tabard) {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.04), mat(L.tabard));
    tab.position.set(0, 0.82, 0.29);
    rig.add(tab);
    // Gear emblem: the Gearwright Guild.
    const gear = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 4, 8), metal(0xd4a84a));
    gear.position.set(0, 1.02, 0.32);
    rig.add(gear);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 8), trimMat);
  belt.position.y = 0.8;
  rig.add(belt);
  if (armoured) {
    for (const s of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
      pauldron.position.set(s * 0.33, 1.32, 0);
      rig.add(pauldron);
    }
  }
  if (L.scarf) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 5, 10), mat(L.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.4;
    rig.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.04), mat(L.scarf));
    tail.position.set(0.12, 1.2, -0.22);
    tail.rotation.z = 0.3;
    rig.add(tail);
  }
  if (L.sack) {
    const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mat(0x8a7350));
    sack.position.set(0, 1.0, -0.34);
    rig.add(sack);
  }

  // Head with a simple readable face.
  const head = new THREE.Group();
  head.position.y = 1.62;
  rig.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), skinMat);
  skull.scale.set(1, 1.08, 1);
  head.add(skull);
  const eyeWhite = mat(0xf4efe6);
  const pupil = mat(0x1a1410);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeWhite);
    eye.position.set(s * 0.085, 0.03, 0.19);
    head.add(eye);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 4), pupil);
    p.position.set(s * 0.085, 0.03, 0.228);
    head.add(p);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), mat(L.hair ?? 0x2a1a14));
    brow.position.set(s * 0.085, 0.1, 0.205);
    brow.rotation.z = s * -0.12;
    head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.02, 0.23);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.02), mat(0x7a3b30));
  mouth.position.set(0, -0.1, 0.2);
  head.add(mouth);
  if (L.moustache) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), mat(L.hair));
      m.rotation.z = s * (Math.PI / 2 + 0.3);
      m.position.set(s * 0.06, -0.07, 0.215);
      head.add(m);
    }
  }
  if (L.mask) {
    const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.09, 10, 1, true), mat(0x1c1a18));
    mask.position.y = 0.03;
    mask.scale.z = 1.05;
    head.add(mask);
  }

  // Hair / headwear.
  if (L.hairStyle === 'bob') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(L.hair));
    hair.position.set(0, 0.03, -0.02);
    hair.rotation.x = -0.25;
    head.add(hair);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), mat(L.hair));
    fringe.position.set(0, 0.16, 0.15);
    fringe.rotation.x = -0.4;
    head.add(fringe);
  }
  if (L.hairStyle === 'ponytail') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(L.hair));
    hair.position.y = 0.04;
    hair.rotation.x = -0.3;
    head.add(hair);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 5), mat(L.hair));
    tail.position.set(0, -0.05, -0.27);
    tail.rotation.x = 2.6;
    head.add(tail);
  }
  if (L.goggles) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.02, 4, 14), mat(0x3a2a1e));
    band.rotation.x = Math.PI / 2 - 0.35;
    band.position.y = 0.13;
    head.add(band);
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), metal(0xe0b44e));
      lens.rotation.x = Math.PI / 2 - 0.5;
      lens.position.set(s * 0.08, 0.2, 0.15);
      head.add(lens);
      const glass = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 8),
        new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x3a6a8a, emissiveIntensity: 0.6, roughness: 0.1 })
      );
      glass.position.set(s * 0.08, 0.215, 0.175);
      glass.rotation.x = -0.5;
      head.add(glass);
    }
  }
  if (L.hood) {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 7, 1, true), mat(L.hood, { side: THREE.DoubleSide }));
    hood.position.set(0, 0.08, -0.04);
    hood.rotation.x = -0.15;
    head.add(hood);
  }
  if (L.hat === 'tricorn') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 3), mat(0x1e1a16));
    brim.position.y = 0.2;
    brim.rotation.y = Math.PI;
    head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.16, 8), mat(0x1e1a16));
    crown.position.y = 0.29;
    head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.03, 8), mat(L.scarf ?? 0xc4302b));
    band.position.y = 0.23;
    head.add(band);
  }
  if (L.helmet === 'visor') {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.42, 8), metal(L.armour));
    helm.position.y = 0.03;
    head.add(helm);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), metal(L.armour));
    top.position.y = 0.24;
    head.add(top);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.02), mat(0x0a0a0a));
    slit.position.set(0, 0.04, 0.255);
    head.add(slit);
  }
  if (L.helmet === 'open') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.45), metal(L.armour));
    top.position.y = 0.06;
    head.add(top);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.06), metal(L.armour));
    guard.position.set(0, 0.05, 0.24);
    head.add(guard);
    if (L.plume) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 5), mat(L.plume));
      plume.position.set(0, 0.42, -0.08);
      plume.rotation.x = -0.5;
      head.add(plume);
    }
  }

  // Arms (pivot at the shoulder).
  const arms = [];
  const sleeveMat = armoured ? bodyMat : bodyMat;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.38, 1.32, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.55, 6), sleeveMat);
    arm.position.y = -0.28;
    pivot.add(arm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6), trimMat);
    cuff.position.y = -0.52;
    pivot.add(cuff);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), armoured ? metal(L.armour) : skinMat);
    hand.position.y = -0.6;
    pivot.add(hand);
    if (L.shield && s === -1) {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 6), mat(L.tabard));
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.08, -0.35, 0.05);
      pivot.add(shield);
      const boss = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), metal(0xd4a84a));
      boss.rotation.y = Math.PI / 2;
      boss.position.set(-0.11, -0.35, 0.05);
      pivot.add(boss);
    }
    rig.add(pivot);
    arms.push(pivot);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, rig, torso, head, arms, legs, bodyMat };
}

// Shared walk cycle: phase advances with distance travelled.
export function animateWalk(parts, phase, moving) {
  const swing = moving ? Math.sin(phase) * 0.6 : 0;
  parts.arms[0].rotation.x = swing;
  parts.arms[1].rotation.x = -swing;
  parts.legs[0].rotation.x = -swing * 0.9;
  parts.legs[1].rotation.x = swing * 0.9;
  parts.rig.position.y = moving ? Math.abs(Math.sin(phase)) * 0.05 : 0;
}
