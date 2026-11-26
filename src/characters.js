import * as THREE from 'three';

// Simple procedural humanoid: capsule torso, sphere head, two arms.
// Returns the root group plus handles to parts we animate.
export function buildHumanoid({ body, accent, skin = 0xe0b899, scale = 1, hood = false, helmet = false }) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); // tilts/rotates for knockdown
  root.add(rig);

  const bodyMat = new THREE.MeshStandardMaterial({ color: body, roughness: 0.8 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), bodyMat);
  torso.position.y = 0.85;
  rig.add(torso);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 6, 16), accentMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.75;
  rig.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skinMat);
  head.position.y = 1.55;
  rig.add(head);

  if (hood) {
    const h = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      bodyMat
    );
    h.position.y = 1.58;
    h.rotation.x = -0.25;
    rig.add(h);
  }
  if (helmet) {
    const h = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.27, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.8, roughness: 0.3 })
    );
    h.position.y = 1.62;
    rig.add(h);
  }

  // Eyes so facing direction reads at a glance.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat);
    eye.position.set(s * 0.08, 1.58, 0.2);
    rig.add(eye);
  }

  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.42, 1.25, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 3, 8), bodyMat);
    arm.position.y = -0.3;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skinMat);
    hand.position.y = -0.6;
    pivot.add(hand);
    rig.add(pivot);
    arms.push(pivot);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
    }
  });

  return { root, rig, torso, head, arms, bodyMat };
}
