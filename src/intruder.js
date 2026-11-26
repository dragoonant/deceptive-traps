import * as THREE from 'three';
import { INTRUDERS, GRAVITY, ENV } from './config.js';
import { HALF_W, HALF_D } from './room.js';
import { buildHumanoid } from './characters.js';
import { ComboTracker } from './combo.js';

let nextId = 1;

export class Intruder {
  constructor(scene, type, spawnPos) {
    this.id = nextId++;
    this.type = type;
    this.def = INTRUDERS[type];
    const look =
      type === 'knight'
        ? { body: 0x5d6670, accent: 0x8c2f2f, helmet: true }
        : { body: this.def.color, accent: 0x3a2a1a, hood: true };
    const h = buildHumanoid({ ...look, scale: this.def.scale });
    this.mesh = h.root;
    this.parts = h;
    scene.add(this.mesh);
    this.scene = scene;

    this.pos = spawnPos.clone();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.hp = this.def.hp;
    this.grounded = true;
    // States: walk, windup, recover, knocked, restrained, stunned, dead
    this.state = 'walk';
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.walkPhase = Math.random() * 6;
    this.flash = 0;
    this.combo = new ComboTracker();
    this.wallSlamLock = 0; // prevents one impact counting twice
    this.deadTime = 0;
    this.removed = false;
  }

  get alive() {
    return this.state !== 'dead';
  }

  // Apply a hit from a trap or the environment. game.onHit handles score/FX.
  takeHit(game, sourceName, baseDamage, knock = null, opts = {}) {
    if (!this.alive) return;
    const mult = this.combo.hit(sourceName);
    const dmg = Math.round(baseDamage * mult);
    this.hp -= dmg;
    this.flash = 0.15;

    if (knock) {
      const k = 1 - this.def.knockbackResist;
      this.vel.set(knock.x * k, knock.y * (0.5 + 0.5 * k), knock.z * k);
      if (this.vel.y > 0) this.grounded = false;
      // Knockback always wins: it breaks clamps and interrupts attacks.
      this.setState('knocked');
    }
    if (opts.restrain) {
      this.vel.set(0, 0, 0);
      this.setState('restrained', opts.restrain);
      if (opts.anchor) {
        this.pos.x = opts.anchor.x;
        this.pos.z = opts.anchor.z;
      }
    }
    if (opts.stun) {
      this.setState('stunned', opts.stun);
    }

    game.onHit(this, sourceName, dmg, mult);
    if (this.hp <= 0) this.die(game);
  }

  setState(s, t = 0) {
    this.state = s;
    this.stateTimer = t;
  }

  die(game) {
    this.hp = 0;
    this.setState('dead');
    const summary = this.combo.finish();
    game.onKill(this, summary);
  }

  update(dt, game) {
    const player = game.player;
    this.flash = Math.max(0, this.flash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.wallSlamLock = Math.max(0, this.wallSlamLock - dt);

    const summary = this.combo.update(dt);
    if (summary) game.onComboEnd(this, summary);

    if (this.state === 'dead') {
      this.deadTime += dt;
      this.parts.rig.rotation.x = Math.min(Math.PI / 2, this.parts.rig.rotation.x + dt * 5);
      this.applyPhysics(dt, game, false);
      if (this.deadTime > 2.5) {
        this.mesh.position.y -= dt * 0.6;
        if (this.deadTime > 4) {
          this.scene.remove(this.mesh);
          this.removed = true;
        }
      } else {
        this.mesh.position.copy(this.pos);
      }
      return;
    }

    const toPlayer = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length();
    if (dist > 0.001) toPlayer.divideScalar(dist);

    switch (this.state) {
      case 'walk': {
        if (!player.dead) {
          this.faceToward(toPlayer, dt, 8);
          const desired = toPlayer.clone().multiplyScalar(this.def.speed);
          if (dist < this.def.attackRange * 0.85) desired.set(0, 0, 0);
          this.vel.x += (desired.x - this.vel.x) * Math.min(1, dt * 8);
          this.vel.z += (desired.z - this.vel.z) * Math.min(1, dt * 8);
          if (dist < this.def.attackRange && this.attackCooldown === 0) {
            this.setState('windup', this.def.windup);
          }
        } else {
          this.vel.x *= 0.8;
          this.vel.z *= 0.8;
        }
        break;
      }
      case 'windup': {
        this.vel.x *= 0.7;
        this.vel.z *= 0.7;
        this.faceToward(toPlayer, dt, 4);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (dist < this.def.attackRange + 0.4) game.onIntruderAttack(this);
          this.attackCooldown = this.def.attackCooldown;
          this.setState('recover', 0.35);
        }
        break;
      }
      case 'recover':
      case 'stunned':
      case 'restrained': {
        if (this.grounded) {
          this.vel.x *= 0.6;
          this.vel.z *= 0.6;
        }
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.setState('walk');
        break;
      }
      case 'knocked': {
        if (this.grounded) {
          this.vel.x *= Math.pow(0.002, dt);
          this.vel.z *= Math.pow(0.002, dt);
          if (Math.hypot(this.vel.x, this.vel.z) < 0.8) this.setState('recover', 0.4);
        }
        break;
      }
    }

    if (this.state === 'restrained') {
      this.vel.set(0, Math.min(this.vel.y, 0), 0);
    }

    this.applyPhysics(dt, game, true);
    this.animate(dt);
  }

  faceToward(dir, dt, rate) {
    if (dir.lengthSq() < 1e-4) return;
    const target = Math.atan2(dir.x, dir.z);
    let d = target - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * rate);
  }

  applyPhysics(dt, game, envHits) {
    if (!this.grounded) this.vel.y -= GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y <= 0) {
      if (!this.grounded) {
        const fall = -this.vel.y;
        this.grounded = true;
        this.pos.y = 0;
        this.vel.y = 0;
        if (envHits && fall > ENV.hardLanding.minFallSpeed) {
          this.takeHit(game, ENV.hardLanding.name, ENV.hardLanding.damage);
        }
      } else {
        this.pos.y = 0;
        this.vel.y = 0;
      }
    }

    // Walls: clamp, and fast impacts count as a Wall Slam.
    const r = this.def.radius * this.def.scale;
    const bounds = [
      ['x', -HALF_W + r, 1],
      ['x', HALF_W - r, -1],
      ['z', -HALF_D + r, 1],
      ['z', HALF_D - r, -1],
    ];
    for (const [axis, limit, sign] of bounds) {
      const past = sign > 0 ? this.pos[axis] < limit : this.pos[axis] > limit;
      if (past) {
        this.pos[axis] = limit;
        const into = -sign * this.vel[axis];
        if (into > 0) {
          if (envHits && into > ENV.wallSlam.minSpeed && this.wallSlamLock === 0 && this.alive) {
            this.wallSlamLock = 0.3;
            this.vel[axis] = sign * into * 0.25;
            this.takeHit(game, ENV.wallSlam.name, ENV.wallSlam.damage);
          } else {
            this.vel[axis] = 0;
          }
        }
      }
    }
  }

  animate(dt) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const rig = this.parts.rig;
    const arms = this.parts.arms;
    this.walkPhase += dt * speed * 2.4;

    rig.rotation.set(0, 0, 0);
    rig.position.y = 0;
    if (this.state === 'walk') {
      const s = Math.sin(this.walkPhase) * 0.6;
      arms[0].rotation.x = s;
      arms[1].rotation.x = -s;
      rig.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
    } else if (this.state === 'windup') {
      const t = 1 - this.stateTimer / this.def.windup;
      arms[0].rotation.x = arms[1].rotation.x = -Math.PI * 0.9 * t;
    } else if (this.state === 'recover') {
      arms[0].rotation.x = arms[1].rotation.x = 0.4;
    } else if (this.state === 'knocked') {
      rig.rotation.x = this.grounded ? -0.3 : -0.8;
      arms[0].rotation.z = 1.2;
      arms[1].rotation.z = -1.2;
    } else if (this.state === 'stunned') {
      rig.rotation.z = Math.sin(performance.now() / 90) * 0.15;
      rig.position.y = -0.1;
      arms[0].rotation.x = arms[1].rotation.x = 0.2;
    } else if (this.state === 'restrained') {
      rig.rotation.z = Math.sin(performance.now() / 50) * 0.08;
      arms[0].rotation.x = arms[1].rotation.x = -0.5;
    }
    if (this.state !== 'knocked') {
      arms[0].rotation.z = 0;
      arms[1].rotation.z = 0;
    }

    this.parts.bodyMat.emissive.setHex(
      this.flash > 0 ? 0xffffff : this.state === 'windup' ? 0x551100 : 0x000000
    );
    this.parts.bodyMat.emissiveIntensity = this.flash > 0 ? 0.8 : 1;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
  }
}
