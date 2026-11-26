// On-screen controls for phones and tablets.
//
//   Left half of the screen   floating joystick (appears where the thumb lands)
//   Right half of the screen  drag to turn the camera; quick tap selects a tile in setup
//   Right-hand button grid    setup: Place / Rotate / Sell / Start
//                             wave:  Floor / Wall / Ceiling / Dash
//   Trap palette              tap a slot to choose that trap
//   Title / end screens       tap to start
//
// Buttons feed the same Input object as the keyboard, so game logic doesn't
// know or care where a press came from.
import { CATEGORIES } from './config.js';

const STICK_RADIUS = 56; // px the knob can travel from the base centre
const LOOK_GAIN = 1.8; // touch-drag pixels -> mouse-pixel equivalents
const TAP_MAX_MOVE = 12;
const TAP_MAX_MS = 300;

export function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export class TouchControls {
  constructor(input, game) {
    this.input = input;
    this.game = game;
    this.enabled = false;
    this.stick = null; // { id, ox, oy }
    this.look = null; // { id, x, y, sx, sy, t, moved }

    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.innerHTML = `
      <div id="joy"><div id="joy-knob"></div></div>
      <div id="tgrid" class="setup">
        <button data-act="place" class="tb big">Place</button>
        <button data-act="rotate" class="tb">↻</button>
        <button data-act="sell" class="tb">Sell</button>
        <button data-act="start" class="tb go">Start ▶</button>
        <button data-act="floor" class="tb trig" data-cat="floor">${CATEGORIES.floor.label}</button>
        <button data-act="wall" class="tb trig" data-cat="wall">${CATEGORIES.wall.label}</button>
        <button data-act="ceiling" class="tb trig" data-cat="ceiling">${CATEGORIES.ceiling.label}</button>
        <button data-act="dash" class="tb dash">Dash</button>
      </div>`;
    document.body.appendChild(this.root);
    this.joyEl = this.root.querySelector('#joy');
    this.knobEl = this.root.querySelector('#joy-knob');
    this.grid = this.root.querySelector('#tgrid');
    this.trigButtons = [...this.grid.querySelectorAll('.trig')];

    for (const b of this.grid.querySelectorAll('button')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.enable();
        this.action(b.dataset.act);
        b.classList.add('down');
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }

    // Trap palette slots become tappable (keys 1-5 select traps in setup).
    document.querySelectorAll('#palette .slot').forEach((el, idx) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.input.press(String(idx + 1));
      });
    });

    // Tapping a title/victory/defeat screen starts the run (works with a mouse too).
    document.querySelectorAll('.screen').forEach((el) =>
      el.addEventListener('pointerup', () => this.input.press('Enter'))
    );

    const canvas = input.canvas;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    // Any real touch switches the UI into touch mode, even on hybrid laptops.
    window.addEventListener('touchstart', () => this.enable(), { passive: true });

    if (isTouchDevice()) this.enable();
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.game.touchMode = true;
    this.input.touchMode = true;
    document.body.classList.add('touch');
  }

  action(act) {
    const input = this.input;
    switch (act) {
      case 'place':
        input.clicks.push(0);
        break;
      case 'sell':
        input.clicks.push(2);
        break;
      case 'rotate':
        input.press('r');
        break;
      case 'start':
        input.press('Enter');
        break;
      case 'dash':
        input.press(' ');
        break;
      default:
        if (CATEGORIES[act]) input.press(CATEGORIES[act].key);
    }
  }

  onDown(e) {
    if (e.pointerType === 'mouse') return; // desktop keeps mouse + pointer lock
    this.enable();
    e.preventDefault();
    const leftHalf = e.clientX < window.innerWidth / 2;
    if (leftHalf && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      this.joyEl.style.left = `${e.clientX}px`;
      this.joyEl.style.top = `${e.clientY}px`;
      this.joyEl.classList.add('active');
      this.setKnob(0, 0);
      this.input.joy.active = true;
    } else if (!this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
    }
  }

  onMove(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.ox;
      let dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS) {
        dx = (dx / d) * STICK_RADIUS;
        dy = (dy / d) * STICK_RADIUS;
      }
      this.setKnob(dx, dy);
      this.input.joy.x = dx / STICK_RADIUS;
      this.input.joy.y = dy / STICK_RADIUS;
    } else if (this.look && e.pointerId === this.look.id) {
      const dx = e.clientX - this.look.x;
      const dy = e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      this.look.moved = Math.max(this.look.moved, Math.hypot(e.clientX - this.look.sx, e.clientY - this.look.sy));
      this.input.mouseDX += dx * LOOK_GAIN;
      this.input.mouseDY += dy * LOOK_GAIN;
    }
  }

  onUp(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      this.releaseStick();
    } else if (this.look && e.pointerId === this.look.id) {
      const quick = performance.now() - this.look.t < TAP_MAX_MS;
      if (quick && this.look.moved < TAP_MAX_MOVE) {
        const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
        const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
        this.game.selectTileAtScreen(ndcX, ndcY);
      }
      this.look = null;
    }
  }

  setKnob(dx, dy) {
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Called every rendered frame to match buttons to the game phase.
  update(game) {
    if (!this.enabled) return;
    const playing = game.state === 'setup' || game.state === 'wave';
    this.root.classList.toggle('show', playing);
    this.grid.className = game.state === 'wave' ? 'wave' : 'setup';
    if (game.state === 'wave') {
      for (const b of this.trigButtons) {
        const info = game.categoryStatus(b.dataset.cat);
        b.classList.toggle('armed', info.armed > 0);
        b.classList.toggle('empty', info.total === 0);
      }
    }
    if (!playing && this.stick) this.releaseStick();
  }

  releaseStick() {
    this.stick = null;
    this.joyEl.classList.remove('active');
    this.joyEl.style.left = this.joyEl.style.top = ''; // back to its resting spot
    this.setKnob(0, 0);
    Object.assign(this.input.joy, { x: 0, y: 0, active: false });
  }
}
