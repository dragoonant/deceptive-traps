// The manor's layout as a tile map, plus everything spatial: coordinates,
// wall collision, line of sight and pathfinding. Pure logic, no rendering.
import { TILE } from './config.js';

// Legend: '.' solid stone. Any other character is a walkable tile belonging to
// that area. Walls are generated wherever a walkable tile meets solid stone.
const MAP = [
  '.........AAAAAAAAA.........',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  'CCCCCCCwwAAAAAAAAAeeGGGGGGG',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  'CCCCCCC..AAAAAAAAA..GGGGGGG',
  '.........AAAAAAAAA.........',
];

export const AREAS = {
  A: { name: 'Grand Foyer', floor: 0xd8cfc4, light: 0xffa24a },
  C: { name: 'Boiler Room', floor: 0xc9a58a, light: 0xff7a2a },
  G: { name: 'Gallery', floor: 0xb9c3d6, light: 0x9fc0ff },
  w: { name: 'West Passage', floor: 0xa89d92, light: 0xffb070 },
  e: { name: 'East Passage', floor: 0xa89d92, light: 0xffb070 },
};

// Spawn doors: the walkable tile intruders appear on, and the wall side the door is cut into.
export const DOORS = {
  north: { i: 13, j: 0, side: { x: 0, z: -1 } },
  east: { i: 26, j: 4, side: { x: 1, z: 0 } },
};

// Solid furniture inside rooms. These tiles keep their area (for floors and names)
// but block movement and sight like stone, so they also count for Wall Slams.
// Rendered by props.js instead of as brick walls.
export const OBSTACLES = [
  { i: 1, j: 1, type: 'boiler' },
  { i: 1, j: 7, type: 'boiler' },
  { i: 0, j: 4, type: 'furnace' },
  { i: 11, j: 6, type: 'pillar' },
  { i: 15, j: 6, type: 'pillar' },
  { i: 23, j: 2, type: 'statue' },
  { i: 23, j: 6, type: 'statue' },
];
export const OBSTACLE_H = 3.2; // the camera may pass above furniture

export const W = MAP[0].length;
export const D = MAP.length;
export const HALF_W = (W * TILE) / 2;
export const HALF_D = (D * TILE) / 2;
export const PLAYER_START = { i: 13, j: 6 };

const SIDES = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

export function areaAt(i, j) {
  if (i < 0 || j < 0 || i >= W || j >= D) return null;
  const c = MAP[j][i];
  return c === '.' ? null : c;
}

const obstacleIndex = new Map(OBSTACLES.map((o) => [o.i + o.j * W, o]));

export function obstacleAt(i, j) {
  if (i < 0 || j < 0 || i >= W || j >= D) return null;
  return obstacleIndex.get(i + j * W) ?? null;
}

export function isWalkable(i, j) {
  return areaAt(i, j) !== null && !obstacleAt(i, j);
}

export function isDoorTile(i, j) {
  return Object.values(DOORS).some((d) => d.i === i && d.j === j);
}

export function tileCenter(i, j, out = { x: 0, y: 0, z: 0 }) {
  out.x = (i - (W - 1) / 2) * TILE;
  out.y = 0;
  out.z = (j - (D - 1) / 2) * TILE;
  return out;
}

export function worldToTile(x, z) {
  return { i: Math.floor((x + HALF_W) / TILE), j: Math.floor((z + HALF_D) / TILE) };
}

export function areaNameAt(x, z) {
  const t = worldToTile(x, z);
  const a = areaAt(t.i, t.j);
  return a ? AREAS[a].name : '';
}

// Directions a wall-mounted trap on this tile could face (away from each adjacent wall).
export function inwardDirs(i, j) {
  if (!isWalkable(i, j)) return [];
  return SIDES.filter((s) => !isWalkable(i + s.x, j + s.z)).map((s) => ({ x: -s.x || 0, z: -s.z || 0 }));
}

// Every wall segment: a walkable tile edge that faces solid stone.
export function wallSegments() {
  const out = [];
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (!isWalkable(i, j)) continue;
      for (const s of SIDES) {
        if (isWalkable(i + s.x, j + s.z)) continue;
        if (obstacleAt(i + s.x, j + s.z)) continue; // furniture, not a wall
        const door = Object.values(DOORS).find((d) => d.i === i && d.j === j && d.side.x === s.x && d.side.z === s.z);
        out.push({ i, j, side: s, door: !!door });
      }
    }
  }
  return out;
}

// Resolve a circle against the walls. Mutates pos (and vel's into-wall component
// is left to the caller). Returns impacts as { nx, nz, into } where n points
// away from the wall and `into` is the speed the body hit it with.
export function collideCircle(pos, vel, r) {
  const impacts = [];
  let { i, j } = worldToTile(pos.x, pos.z);
  if (!isWalkable(i, j)) return impacts; // caller handles tunnelling
  const c = tileCenter(i, j);
  const h = TILE / 2;
  for (const s of SIDES) {
    if (isWalkable(i + s.x, j + s.z)) continue;
    const axis = s.x !== 0 ? 'x' : 'z';
    const sign = s.x !== 0 ? s.x : s.z;
    const edge = c[axis] + sign * h;
    const pen = sign > 0 ? pos[axis] + r - edge : edge - (pos[axis] - r);
    if (pen > 0) {
      pos[axis] -= sign * pen;
      const into = sign * vel[axis];
      impacts.push({ nx: -s.x, nz: -s.z, into: Math.max(0, into) });
    }
  }
  // Outside corners: solid diagonal with both orthogonal neighbours open.
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      if (isWalkable(i + dx, j + dz) || !isWalkable(i + dx, j) || !isWalkable(i, j + dz)) continue;
      const cx = c.x + dx * h;
      const cz = c.z + dz * h;
      const ox = pos.x - cx;
      const oz = pos.z - cz;
      const d = Math.hypot(ox, oz);
      if (d < r && d > 1e-6) {
        const nx = ox / d;
        const nz = oz / d;
        pos.x = cx + nx * r;
        pos.z = cz + nz * r;
        impacts.push({ nx, nz, into: Math.max(0, -(vel.x * nx + vel.z * nz)) });
      }
    }
  }
  return impacts;
}

// Walk from a to b; returns the last point before entering stone (or b itself).
// Points above wall height pass freely so the camera can rise over walls.
export function lastFreePoint(a, b, wallH = Infinity, step = 0.2) {
  const dx = b.x - a.x;
  const dy = (b.y ?? 0) - (a.y ?? 0);
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  const n = Math.max(1, Math.ceil(len / step));
  let last = { x: a.x, y: a.y ?? 0, z: a.z };
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const p = { x: a.x + dx * t, y: (a.y ?? 0) + dy * t, z: a.z + dz * t };
    const tile = worldToTile(p.x, p.z);
    const limit = obstacleAt(tile.i, tile.j) ? Math.min(wallH, OBSTACLE_H) : wallH;
    if (p.y < limit && !isWalkable(tile.i, tile.j)) return { point: last, blocked: true };
    last = p;
  }
  return { point: last, blocked: false };
}

export function lineOfSight(a, b) {
  return !lastFreePoint({ x: a.x, y: 0, z: a.z }, { x: b.x, y: 0, z: b.z }).blocked;
}

// Breadth-first distance field from a goal tile, 8-way without corner cutting.
export function flowField(goal) {
  const dist = new Int32Array(W * D).fill(-1);
  if (!isWalkable(goal.i, goal.j)) return dist;
  const q = [goal.i + goal.j * W];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    const i = cur % W;
    const j = (cur - i) / W;
    for (const [dx, dz] of NEIGHBOURS) {
      const ni = i + dx;
      const nj = j + dz;
      if (!canStep(i, j, dx, dz)) continue;
      const k = ni + nj * W;
      if (dist[k] !== -1) continue;
      dist[k] = dist[cur] + 1;
      q.push(k);
    }
  }
  return dist;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function canStep(i, j, dx, dz) {
  if (!isWalkable(i + dx, j + dz)) return false;
  if (dx !== 0 && dz !== 0) return isWalkable(i + dx, j) && isWalkable(i, j + dz);
  return true;
}

// Next tile toward the goal of a flow field, or null if already there / unreachable.
export function nextStep(dist, i, j) {
  const here = dist[i + j * W];
  if (here <= 0) return null;
  let best = null;
  let bestD = here;
  for (const [dx, dz] of NEIGHBOURS) {
    if (!canStep(i, j, dx, dz)) continue;
    const d = dist[i + dx + (j + dz) * W];
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = { i: i + dx, j: j + dz };
    }
  }
  return best;
}
