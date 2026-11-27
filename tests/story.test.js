// Integrity checks for story scripts: every speaker has a portrait, every
// wave references real intruders and doors, notes hang on real walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHTS } from '../src/story/night1.js';
import { INTRUDERS } from '../src/config.js';
import { DOORS, isWalkable } from '../src/level.js';
import { BARKS } from '../src/story/barks.js';

// portraits.js imports WebGL helpers; read its speaker ids textually instead.
import { readFileSync } from 'node:fs';
const portraitsSrc = readFileSync(new URL('../src/story/portraits.js', import.meta.url), 'utf8');
const speakerIds = new Set([...portraitsSrc.matchAll(/^\s{2}(\w+): \{ name:/gm)].map((m) => m[1]));
const tableauxSrc = readFileSync(new URL('../src/story/tableaux.js', import.meta.url), 'utf8');
const tableauIds = new Set([...tableauxSrc.matchAll(/^\s{2}(\w+)\(scene\) \{/gm)].map((m) => m[1]));

function allLines(night) {
  const out = [...night.opening, ...night.closing];
  for (const w of night.waves) {
    out.push(...(w.onStart ?? []), ...(w.onClear ?? []));
    for (const lines of Object.values(w.onSpawn ?? {})) out.push(...lines);
  }
  return out;
}

for (const night of NIGHTS) {
  test(`night ${night.id}: every line has a known speaker and short text`, () => {
    for (const line of allLines(night)) {
      assert.ok(speakerIds.has(line.who), `unknown speaker ${line.who}`);
      assert.ok(line.text.length > 0 && line.text.length <= 140, `line too long: ${line.text}`);
    }
  });

  test(`night ${night.id}: waves use real intruders and doors; entrances match spawns`, () => {
    for (const w of night.waves) {
      for (const [type, door] of w.intruders) {
        assert.ok(INTRUDERS[type], `unknown intruder ${type}`);
        assert.ok(DOORS[door], `unknown door ${door}`);
      }
      for (const type of Object.keys(w.onSpawn ?? {})) {
        assert.ok(w.intruders.some(([t]) => t === type), `entrance for ${type} but it never spawns`);
        assert.ok(INTRUDERS[type].named, `${type} has an entrance but isn't a named intruder`);
      }
    }
  });

  test(`night ${night.id}: cutscene panels exist`, () => {
    for (const p of [...night.intro.panels, ...night.outro.panels]) {
      assert.ok(tableauIds.has(p.scene), `unknown tableau ${p.scene}`);
      assert.ok(p.caption.length <= 160);
    }
  });

  test(`night ${night.id}: notes hang on walls next to walkable tiles`, () => {
    const ids = new Set();
    for (const n of night.notes) {
      assert.ok(!ids.has(n.id), `duplicate note ${n.id}`);
      ids.add(n.id);
      assert.ok(isWalkable(n.i, n.j), `note ${n.id} is not on a walkable tile`);
      assert.ok(!isWalkable(n.i + n.side.x, n.j + n.side.z), `note ${n.id} is not against a wall`);
    }
  });
}

test('barks exist for every common intruder type', () => {
  assert.ok(BARKS.enter.thief.length && BARKS.enter.knight.length && BARKS.hit.any.length);
});
