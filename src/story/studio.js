// An offscreen "photo studio": a second, small WebGL renderer that turns 3D
// tableaux into still images for portraits and comic panels. Using the game's
// own models keeps story art in the same style as the game.
import * as THREE from 'three';

let studio = null;

function getStudio() {
  if (!studio) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    studio = { canvas, renderer };
  }
  return studio;
}

// Render a scene/camera pair to a PNG data URL at the given size.
export function snapshot(scene, camera, width, height, exposure = 1.2) {
  const { renderer, canvas } = getStudio();
  renderer.setSize(width, height, false);
  renderer.toneMappingExposure = exposure;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  disposeScene(scene);
  return url;
}

// Free GPU memory for one-off scenes. Shared (cached) materials survive because
// the game re-uploads them on demand.
function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.isMesh || o.isPoints) o.geometry?.dispose();
  });
}

// Standard three-point lighting rig for portraits and close-ups.
export function studioLights(scene, key = 0xffe2c0, rim = 0x8fb0ff) {
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x302018, 0.9));
  const k = new THREE.DirectionalLight(key, 2.4);
  k.position.set(1.5, 2.5, 3);
  scene.add(k);
  const r = new THREE.DirectionalLight(rim, 1.6);
  r.position.set(-2, 2, -2.5);
  scene.add(r);
  const f = new THREE.DirectionalLight(0xffffff, 0.5);
  f.position.set(-2, 0.5, 2);
  scene.add(f);
}
