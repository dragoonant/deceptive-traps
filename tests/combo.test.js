import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComboTracker, scoreChain } from '../src/combo.js';

const cfg = { window: 3, stepMultiplier: 0.25, maxMultiplier: 3, varietyBonus: 50 };

test('first hit has no multiplier, chained hits ramp up', () => {
  const c = new ComboTracker(cfg);
  assert.equal(c.hit('Spring'), 1);
  assert.equal(c.hit('Wall Slam'), 1.25);
  assert.equal(c.hit('Weight'), 1.5);
  assert.equal(c.count, 3);
});

test('multiplier is capped', () => {
  const c = new ComboTracker(cfg);
  for (let k = 0; k < 20; k++) c.hit('Ram');
  assert.equal(c.nextMultiplier(), 3);
});

test('chain expires after the window and reports a summary', () => {
  const c = new ComboTracker(cfg);
  c.hit('Ram');
  c.hit('Clamp');
  assert.equal(c.update(2.9), null);
  const s = c.update(0.2);
  assert.ok(s);
  assert.equal(s.hits, 2);
  assert.equal(c.count, 0);
  // Next hit starts fresh.
  assert.equal(c.hit('Spring'), 1);
});

test('hits in the window extend the chain', () => {
  const c = new ComboTracker(cfg);
  c.hit('Ram');
  c.update(2.5);
  assert.equal(c.hit('Clamp'), 1.25);
  c.update(2.5);
  assert.equal(c.count, 2);
});

test('scoring rewards length and variety', () => {
  // 3 hits: triangular 6 * 10 = 60; 3 distinct -> +100
  assert.equal(scoreChain(['A', 'B', 'C'], cfg).score, 160);
  // Same trap repeated earns no variety bonus.
  assert.equal(scoreChain(['A', 'A', 'A'], cfg).score, 60);
});

test('finish on empty chain returns null', () => {
  assert.equal(new ComboTracker(cfg).finish(), null);
});
