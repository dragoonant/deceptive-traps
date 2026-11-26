import * as THREE from 'three';
import { Input } from './input.js';
import { Game } from './game.js';
import './style.css';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060a);
scene.fog = new THREE.Fog(0x07060a, 18, 40);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

const input = new Input(canvas);
const game = new Game({ renderer, scene, camera, input });
window.__game = game; // handy for debugging and automated smoke tests

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const STEP = 1 / 60;
const MAX_STEPS = 12; // below ~5 FPS the game slows down instead of spiralling
let last = performance.now();
let acc = 0;
function frame(now) {
  const frameDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += frameDt;
  game.beginFrame(frameDt);
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    game.step(STEP);
    // Key presses and clicks count once per frame, not once per sub-step.
    if (steps === 0) input.endFrame();
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS) acc = 0;
  if (steps === 0) input.endFrameIfIdle();
  game.endFrame(frameDt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
