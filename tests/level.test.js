import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  W,
  D,
  DOORS,
  PLAYER_START,
  isWalkable,
  inwardDirs,
  flowField,
  nextStep,
  lineOfSight,
  tileCenter,
  collideCircle,
  worldToTile,
} from '../src/level.js';

test('doors and the player start are on walkable tiles', () => {
  for (const d of Object.values(DOORS)) {
    assert.ok(isWalkable(d.i, d.j));
    assert.ok(!isWalkable(d.i + d.side.x, d.j + d.side.z), 'door must be cut into a wall');
  }
  assert.ok(isWalkable(PLAYER_START.i, PLAYER_START.j));
});

test('every walkable tile is reachable from the player start', () => {
  const dist = flowField(PLAYER_START);
  for (let j = 0; j < D; j++)
    for (let i = 0; i < W; i++) if (isWalkable(i, j)) assert.ok(dist[i + j * W] >= 0, `(${i},${j}) unreachable`);
});

test('following the flow field walks from the east door to the Boiler Room', () => {
  const goal = { i: 2, j: 2 };
  const dist = flowField(goal);
  let cur = { i: DOORS.east.i, j: DOORS.east.j };
  const visited = [cur];
  for (let k = 0; k < 100 && (cur.i !== goal.i || cur.j !== goal.j); k++) {
    cur = nextStep(dist, cur.i, cur.j);
    assert.ok(cur, 'path should not dead-end');
    visited.push(cur);
  }
  assert.deepEqual(cur, goal);
  // The only way west is through both corridors on row 4.
  assert.ok(visited.some((t) => t.i === 19 && t.j === 4));
  assert.ok(visited.some((t) => t.i === 7 && t.j === 4));
});

test('walls block line of sight between rooms', () => {
  const foyer = tileCenter(13, 2);
  const boiler = tileCenter(3, 2);
  assert.equal(lineOfSight(foyer, boiler), false);
  assert.equal(lineOfSight(tileCenter(10, 2), tileCenter(16, 4)), true);
});

test('corridor tiles offer rams both side walls', () => {
  assert.deepEqual(inwardDirs(7, 4).sort((a, b) => a.z - b.z), [
    { x: 0, z: -1 },
    { x: 0, z: 1 },
  ]);
  assert.deepEqual(inwardDirs(13, 4), []); // middle of the Foyer
});

test('collision keeps a body out of stone and reports impact speed', () => {
  const c = tileCenter(9, 2); // west wall of the Foyer
  const pos = { x: c.x - 0.9, z: c.z };
  const vel = { x: -10, z: 0 };
  const hits = collideCircle(pos, vel, 0.4);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].nx, 1);
  assert.equal(hits[0].into, 10);
  assert.ok(pos.x >= c.x - 1 + 0.4 - 1e-9);
  const t = worldToTile(pos.x, pos.z);
  assert.ok(isWalkable(t.i, t.j));
});

test('furniture blocks movement and sight but is not rendered as wall', async () => {
  const { OBSTACLES, obstacleAt, wallSegments } = await import('../src/level.js');
  for (const o of OBSTACLES) {
    assert.equal(isWalkable(o.i, o.j), false);
    assert.ok(obstacleAt(o.i, o.j));
  }
  // No brick wall slab faces a furniture tile.
  for (const seg of wallSegments()) assert.equal(obstacleAt(seg.i + seg.side.x, seg.j + seg.side.z), null);
  // A pillar hides the Keeper from an intruder directly behind it.
  assert.equal(lineOfSight(tileCenter(11, 5), tileCenter(11, 7)), false);
});
