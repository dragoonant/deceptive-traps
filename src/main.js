import * as THREE from 'three';
import { Input } from './input.js';
import { Game } from './game.js';
import { TouchControls, isTouchDevice } from './touch.js';
import './style.css';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Phones get a lighter render: lower resolution scale and cheaper shadows.
const mobile = isTouchDevice();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060a);
scene.fog = new THREE.Fog(0x120e12, 30, 70);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
// Portrait screens are narrow, so widen the vertical FOV to keep a usable view.
const fitFov = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 78 : 60;
  camera.updateProjectionMatrix();
};
fitFov();

const input = new Input(canvas);
const game = new Game({ renderer, scene, camera, input });
window.__game = game; // handy for debugging and automated smoke tests
const touch = new TouchControls(input, game);
if (mobile && game.room.moon) game.room.moon.shadow.mapSize.set(2048, 1024);

window.addEventListener('resize', () => {
  fitFov();
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
  touch.update(game);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
