// Keyboard + mouse state, with "pressed this frame" edges.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicks = []; // button numbers clicked this frame
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (['Tab', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down.delete(k);
    });
    window.addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousedown', (e) => {
      // The first click only captures the mouse; it must not place a trap.
      if (!this.locked) {
        canvas.requestPointerLock?.();
        return;
      }
      this.clicks.push(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  isDown(k) {
    return this.down.has(k);
  }

  wasPressed(k) {
    return this.pressed.has(k);
  }

  // No simulation step ran this frame (high refresh rate): keep key/click edges
  // for the next step, but drop mouse motion, which the camera already used.
  endFrameIfIdle() {
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  endFrame() {
    this.pressed.clear();
    this.clicks.length = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
