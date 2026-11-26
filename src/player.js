import * as THREE from 'three';
import { PLAYER, WALL_H } from './config.js';
import { collideCircle, lastFreePoint, tileCenter, PLAYER_START } from './level.js';
import { buildHumanoid } from './characters.js';

// The Keeper: cannot fight, only move, dash, and work the house's mechanisms.
export class Player {
  constructor(scene) {
    const h = buildHumanoid({ body: 0x6a4aa0, accent: 0xe0b44e, hood: true });
    this.mesh = h.root;
    this.parts = h;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.resetPos();
    this.vel = new THREE.Vector3();
    this.facing = Math.PI; // radians around Y; 0 = +Z
    this.hp = PLAYER.maxHp;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.iframes = 0;
    this.hurtFlash = 0;
    this.walkPhase = 0;
    this.dead = false;
  }

  resetPos() {
    const c = tileCenter(PLAYER_START.i, PLAYER_START.j);
    this.pos.set(c.x, 0, c.z);
  }

  reset() {
    this.resetPos();
    this.vel.set(0, 0, 0);
    this.hp = PLAYER.maxHp;
    this.dead = false;
    this.parts.rig.rotation.set(0, 0, 0);
  }

  heal(n) {
    this.hp = Math.min(PLAYER.maxHp, this.hp + n);
  }

  hurt(dmg) {
    if (this.iframes > 0 || this.dead) return false;
    this.hp -= dmg;
    this.iframes = PLAYER.iframes;
    this.hurtFlash = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return true;
  }

  update(dt, input, camYaw) {
    if (this.dead) {
      this.parts.rig.rotation.x = Math.min(Math.PI / 2, this.parts.rig.rotation.x + dt * 4);
      this.mesh.position.copy(this.pos);
      return;
    }

    // Camera-relative movement.
    let mx = 0;
    let mz = 0;
    if (input.isDown('w') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('s') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('a') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('d') || input.isDown('ArrowRight')) mx += 1;
    let len = Math.hypot(mx, mz);
    let throttle = 1;
    if (len > 0) {
      mx /= len;
      mz /= len;
    } else if (input.joy.active && Math.hypot(input.joy.x, input.joy.y) > 0.15) {
      // Virtual stick: analog direction, speed scales with how far it's pushed.
      mx = input.joy.x;
      mz = input.joy.y;
      len = Math.hypot(mx, mz);
      throttle = Math.min(1, len);
      mx /= len;
      mz /= len;
    }
    const move = new THREE.Vector3();
    if (len > 0) {
      // Forward is the direction the camera looks (camera sits at +yaw behind).
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      move.set(mx * cos + mz * sin, 0, -mx * sin + mz * cos);
    }

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (input.wasPressed(' ') && this.dashCooldown === 0) {
      const dir = len > 0 ? move.clone() : new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.vel.copy(dir.multiplyScalar(PLAYER.dashSpeed));
      this.dashTimer = PLAYER.dashTime;
      this.dashCooldown = PLAYER.dashCooldown;
      this.iframes = Math.max(this.iframes, PLAYER.dashTime + 0.1);
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else {
      this.vel.copy(move).multiplyScalar(PLAYER.speed * throttle);
    }

    this.pos.addScaledVector(this.vel, dt);
    collideCircle(this.pos, this.vel, PLAYER.radius);

    // Face movement direction smoothly.
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.1) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }

    // Walk cycle.
    this.walkPhase += dt * speed * 2.2;
    const swing = speed > 0.1 ? Math.sin(this.walkPhase) * 0.6 : 0;
    this.parts.arms[0].rotation.x = swing;
    this.parts.arms[1].rotation.x = -swing;
    this.parts.rig.position.y = speed > 0.1 ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
    this.mesh.visible = this.iframes > 0 && this.dashTimer <= 0 ? Math.floor(this.iframes * 30) % 2 === 0 : true;
    this.parts.bodyMat.emissive.setHex(this.hurtFlash > 0 ? 0x661111 : 0x000000);
  }
}

// Third-person orbit camera that follows the player and stays inside the room.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // 0 = camera behind player looking toward -Z
    this.pitch = 0.42;
    this.distance = 7;
    this.shoulder = 1.0;
    this.snap = true; // first frame jumps straight into place
    this.target = new THREE.Vector3();
  }

  offset(pitch) {
    return new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(this.yaw) * Math.cos(pitch)
    ).multiplyScalar(this.distance);
  }

  // Rotate from mouse/keys. Called once per rendered frame, before simulation.
  look(dt, input) {
    const sens = 0.0025;
    this.yaw -= input.mouseDX * sens;
    this.pitch += input.mouseDY * sens;
    if (input.isDown('q')) this.yaw += dt * 2.2;
    if (input.isDown('e')) this.yaw -= dt * 2.2;
    this.pitch = THREE.MathUtils.clamp(this.pitch, 0.1, 1.25);
  }

  // Position behind the player. Called once per rendered frame, after simulation.
  follow(dt, playerPos) {
    // Over-the-shoulder: aim point sits right of the Keeper so the crosshair isn't hidden.
    const sx = Math.cos(this.yaw) * this.shoulder;
    const sz = -Math.sin(this.yaw) * this.shoulder;
    // In a narrow corridor the shoulder point could sit inside stone; stop it at the wall.
    const head = { x: playerPos.x, y: 1.4, z: playerPos.z };
    const sh = lastFreePoint(head, { x: head.x + sx, y: 1.4, z: head.z + sz }, Infinity, 0.05);
    const aim = new THREE.Vector3(sh.point.x, 1.4, sh.point.z);
    if (sh.blocked) aim.lerp(new THREE.Vector3(head.x, 1.4, head.z), 0.3);
    this.target.lerp(aim, Math.min(1, dt * 12));
    // If a wall blocks the view, tilt up over it before resorting to pulling in.
    // Goes nearly top-down if needed, which is what clears a 1-tile corridor.
    let best = null;
    for (let pitch = this.pitch; pitch <= 1.5; pitch += 0.08) {
      const want = this.target.clone().add(this.offset(pitch));
      const hit = lastFreePoint(this.target, want, WALL_H + 0.1, 0.1);
      if (!hit.blocked) {
        best = want;
        break;
      }
      if (!best) best = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z).lerp(this.target, 0.08);
    }
    best.y = THREE.MathUtils.clamp(best.y, 0.6, WALL_H + 3);
    // Smooth so the auto-tilt doesn't snap.
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 10);
    this.snap = false;
    this.camera.position.lerp(best, k);
    this.camera.lookAt(this.target);
  }
}
