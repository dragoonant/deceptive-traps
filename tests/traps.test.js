// Headless simulation tests: traps and intruder physics run without a renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Intruder } from '../src/intruder.js';
import { Trap } from '../src/traps.js';
import { tileCenter, worldToTile } from '../src/level.js';
import { TRAPS } from '../src/config.js';

const scene = { add() {}, remove() {} };

function makeGame() {
  return {
    intruders: [],
    // A dead player keeps intruders from walking, so only trap physics moves them.
    player: { pos: new THREE.Vector3(0, 0, 8), dead: true },
    hits: [],
    kills: 0,
    onHit(n, source) {
      this.hits.push(source);
    },
    onKill() {
      this.kills++;
    },
    onComboEnd() {},
    onIntruderAttack() {},
    shake() {},
  };
}

function spawn(game, type, i, j) {
  const n = new Intruder(scene, type, tileCenter(i, j));
  game.intruders.push(n);
  return n;
}

function step(game, traps, seconds) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    for (const tr of traps) tr.update(dt, game);
    for (const n of game.intruders) n.update(dt, game);
  }
}

const tileOf = (n) => worldToTile(n.pos.x, n.pos.z);

test('piston ram on the Foyer west wall sends a thief 3 tiles out', () => {
  const game = makeGame();
  const ram = new Trap(scene, 'ram', 9, 2, { x: 1, z: 0 });
  const n = spawn(game, 'thief', 9, 2);
  assert.ok(ram.fire(game));
  step(game, [ram], 1.5);
  assert.deepEqual(tileOf(n), { i: 12, j: 2 });
  assert.equal(n.hp, 100 - TRAPS.ram.damage);
});

test('knights resist knockback and travel about half as far', () => {
  const game = makeGame();
  const ram = new Trap(scene, 'ram', 9, 2, { x: 1, z: 0 });
  const n = spawn(game, 'knight', 9, 2);
  ram.fire(game);
  step(game, [ram], 1.5);
  assert.equal(tileOf(n).i, 10);
});

test('spring plate launch ends in a Hard Landing', () => {
  const game = makeGame();
  const spring = new Trap(scene, 'spring', 11, 2, { x: 1, z: 0 });
  spawn(game, 'thief', 11, 2);
  spring.fire(game);
  step(game, [spring], 2);
  assert.deepEqual(game.hits, ['Spring Plate', 'Hard Landing']);
});

test('pendulum next to a wall causes a Wall Slam', () => {
  const game = makeGame();
  const pend = new Trap(scene, 'pendulum', 15, 2, { x: 1, z: 0 });
  spawn(game, 'thief', 15, 2);
  pend.fire(game);
  step(game, [pend], 1.5);
  assert.deepEqual(game.hits, ['Pendulum Blade', 'Wall Slam']);
});

test('ram -> clamp -> weight chains into a 3-hit combo and kills a thief', () => {
  const game = makeGame();
  const ram = new Trap(scene, 'ram', 9, 2, { x: 1, z: 0 });
  const clamp = new Trap(scene, 'clamp', 12, 2, { x: 0, z: 1 });
  const weight = new Trap(scene, 'weight', 12, 2, { x: 0, z: 1 });
  const traps = [ram, clamp, weight];
  const n = spawn(game, 'thief', 9, 2);

  ram.fire(game);
  step(game, traps, 0.9);
  assert.equal(clamp.targetsIn(game.intruders).length, 1, 'thief should be on the clamp tile');
  clamp.fire(game);
  assert.equal(n.state, 'restrained');
  weight.fire(game);
  step(game, traps, 0.6);

  assert.deepEqual(game.hits, ['Piston Ram', 'Gear Clamp', 'Iron Weight']);
  // 20 + round(15*1.25) + round(45*1.5) = 107 damage >= 100 hp
  assert.equal(n.alive, false);
  assert.equal(game.kills, 1);
});

test('traps without a target in their zone report none', () => {
  const game = makeGame();
  const clamp = new Trap(scene, 'clamp', 12, 2, { x: 0, z: 1 });
  spawn(game, 'thief', 15, 6);
  assert.equal(clamp.targetsIn(game.intruders).length, 0);
});

test('a ram in a one-tile corridor slams the thief into the opposite wall', () => {
  const game = makeGame();
  // West Passage tiles (7,4)-(8,4) have stone to the north and south.
  const ram = new Trap(scene, 'ram', 7, 4, { x: 0, z: 1 });
  spawn(game, 'thief', 7, 4);
  ram.fire(game);
  step(game, [ram], 1);
  assert.deepEqual(game.hits, ['Piston Ram', 'Wall Slam']);
});

test('a pendulum swinging along the corridor knocks the thief into the next room', () => {
  const game = makeGame();
  const pend = new Trap(scene, 'pendulum', 7, 4, { x: -1, z: 0 });
  const n = spawn(game, 'thief', 8, 4);
  pend.fire(game);
  step(game, [pend], 2);
  assert.equal(game.hits[0], 'Pendulum Blade');
  const t = tileOf(n);
  assert.ok(t.i <= 6, `expected thief in the Boiler Room, got i=${t.i}`);
});
