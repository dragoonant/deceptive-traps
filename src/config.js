// All gameplay tuning lives here so balance passes don't touch logic.

export const TILE = 2; // world units per grid tile (the map lives in level.js)
export const WALL_H = 5;

export const GRAVITY = 24;

export const PLAYER = {
  speed: 5.2,
  radius: 0.45,
  maxHp: 100,
  dashSpeed: 14,
  dashTime: 0.18,
  dashCooldown: 0.9,
  iframes: 0.35,
};

// Trap trigger categories map to the keys the player presses during a wave.
export const CATEGORIES = {
  floor: { key: '1', label: 'Floor' },
  wall: { key: '2', label: 'Wall' },
  ceiling: { key: '3', label: 'Ceiling' },
};

export const TRAPS = {
  spring: {
    name: 'Spring Plate',
    category: 'floor',
    cost: 30,
    damage: 10,
    cooldown: 3.5,
    knock: { h: 4.3, v: 11 }, // ~2 tiles forward, Hard Landing on touchdown
    color: 0x4fb3a5,
    desc: 'Launches an intruder up and forward.',
  },
  clamp: {
    name: 'Gear Clamp',
    category: 'floor',
    cost: 40,
    damage: 15,
    cooldown: 6,
    holdTime: 3,
    color: 0xb08d57,
    desc: 'Pins an intruder in place. Any knockback breaks the hold.',
  },
  ram: {
    name: 'Piston Ram',
    category: 'wall',
    cost: 50,
    damage: 20,
    cooldown: 4,
    reach: 2, // tiles in front of the wall that the ram head sweeps
    knock: { h: 13, v: 3 }, // thief lands ~2.5 tiles out, i.e. on tile 3 from the wall
    color: 0x8a6d9e,
    desc: 'Mounted on any wall. Punches intruders away from it.',
  },
  pendulum: {
    name: 'Pendulum Blade',
    category: 'ceiling',
    cost: 60,
    damage: 30,
    cooldown: 5,
    knock: { h: 11, v: 4.5 }, // ~3 tiles; Wall Slam if a wall is closer
    color: 0xc75c5c,
    desc: 'Sweeps a 1x3 strip and knocks intruders along its swing.',
  },
  weight: {
    name: 'Iron Weight',
    category: 'ceiling',
    cost: 70,
    damage: 45,
    cooldown: 7,
    dropDelay: 0.4,
    stun: 1.5,
    color: 0x6b7280,
    desc: 'Drops after a short delay. Heavy damage and stun. Time it.',
  },
};

export const TRAP_ORDER = ['spring', 'clamp', 'ram', 'pendulum', 'weight'];

// Environmental hits also count toward combos.
export const ENV = {
  wallSlam: { name: 'Wall Slam', damage: 15, minSpeed: 6 },
  hardLanding: { name: 'Hard Landing', damage: 10, minFallSpeed: 9 },
};

export const COMBO = {
  window: 3.0, // seconds after a hit during which the next hit chains
  stepMultiplier: 0.25, // each chained hit adds +25% damage
  maxMultiplier: 3,
  varietyBonus: 50, // score per distinct trap type in a chain beyond the first
};

export const INTRUDERS = {
  thief: {
    name: 'Thief',
    hp: 100,
    speed: 3.1,
    radius: 0.42,
    knockbackResist: 0,
    damage: 10,
    attackRange: 1.3,
    windup: 0.45,
    attackCooldown: 1.2,
    reward: 40,
    score: 100,
    color: 0x5b8c4a,
    look: 'thief',
    scale: 1,
  },
  knight: {
    name: 'Guild Knight',
    hp: 220,
    speed: 2.1,
    radius: 0.55,
    knockbackResist: 0.5,
    damage: 22,
    attackRange: 1.6,
    windup: 0.7,
    attackCooldown: 1.6,
    reward: 90,
    score: 250,
    color: 0x9aa3ad,
    look: 'knight',
    scale: 1.25,
  },
  // Named story intruders: tougher variants with their own look and lines.
  rook: {
    name: 'Jessamy Rook',
    named: true,
    hp: 170,
    speed: 3.5,
    radius: 0.42,
    knockbackResist: 0.15,
    damage: 14,
    attackRange: 1.3,
    windup: 0.4,
    attackCooldown: 1.0,
    reward: 120,
    score: 600,
    color: 0xc4302b,
    look: 'rook',
    scale: 1.05,
  },
  garrick: {
    name: 'Sir Oswin Garrick',
    named: true,
    hp: 320,
    speed: 2.0,
    radius: 0.55,
    knockbackResist: 0.55,
    damage: 26,
    attackRange: 1.7,
    windup: 0.75,
    attackCooldown: 1.6,
    reward: 150,
    score: 900,
    color: 0xd83030,
    look: 'garrick',
    scale: 1.3,
  },
};

// Waves and starting cogs now live in each night's script (src/story/night*.js).

export const SELL_REFUND = 1; // full refund during setup
