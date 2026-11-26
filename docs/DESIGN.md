# Brassmoor: Deceptive Traps (design doc)

> A trap-defense action game in the tradition of the PlayStation-era
> "you are the house, not the hero" games. Everything here (setting, characters,
> traps, art) is original. The genre is the inspiration. No names, characters,
> levels or assets come from any existing game.

## 1. Pitch

You are **Wren**, the last Keeper of **Brassmoor**, a clockwork manor built by an
inventor who vanished. Treasure hunters, guild enforcers and zealots keep breaking
in to strip the house of its secrets. Wren cannot fight. But the house is one
enormous machine, and Wren knows every lever.

Run through rooms in third person, lure intruders onto the house's mechanisms, and
fire them in sequence. A single trap is a nuisance; a **chain** of traps that
throws an intruder from one mechanism into the next is the point of the game.

## 2. Design pillars

1. **Defenseless protagonist.** The Keeper has no attack. Movement, positioning
   and timing are the only "weapons". Tension comes from being chased.
2. **Readable, tile-true physics.** Every trap moves a body a predictable number
   of tiles. Players should be able to plan "ram → clamp → weight" on paper and
   have it work. (Enforced by `tests/traps.test.js`.)
3. **Combos are the score.** Damage, cogs and score all scale with chain length
   and variety. The best play is the most theatrical play.
4. **Plan, then improvise.** A calm setup phase to design the room, then a
   frantic wave where the plan meets intruders who don't walk where you hoped.

## 3. Core loop

```
 Setup phase                    Wave phase                          Reward
 ─────────────                  ─────────────                       ───────
 Walk the room ──► place /      Intruders enter ──► kite them  ──►  Cogs per kill
 rotate / sell traps            onto trap zones ──► fire by         Score from combos
 (full refund)                  category (1/2/3)                     ──► next setup
```

* **Setup:** time is frozen for intruders. Place traps at the crosshair, rotate
  with R, sell with right-click for a full refund. Press Enter to start the wave.
* **Wave:** traps are fired manually by **category**: `1` floor, `2` wall,
  `3` ceiling. Pressing a key fires every *ready* trap in that category that
  currently has an intruder in its zone. Status lamps show which traps are
  armed (green), idle (amber) or resetting (red).
* **Between waves:** traps reset, the Keeper recovers 30 HP, earned cogs buy
  more traps.

## 4. The manor (prototype layout)

```
            north door
                v
 . . . . . . . . . A A A A A A A A A . . . . . . . . .
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 C C C C C C C w w A A A A A A A A A e e G G G G G G G  < east door
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 C C C C C C C . . A A A A A A A A A . . G G G G G G G
 . . . . . . . . . A A A A A A A A A . . . . . . . . .
```

| Area | Size | Character |
|---|---|---|
| **Grand Foyer** (A) | 9×9 | The hub. Intruders arrive through its north door. Plenty of wall for rams |
| **Boiler Room** (C) | 7×7 | Dead end, warm light. The safest room to retreat to and the best place to stage a finish |
| **Gallery** (G) | 7×7 | Cold light. The east door opens here, so from wave 2 on intruders come from both sides |
| **West / East Passage** (w, e) | 2×1 | One tile wide with stone on both sides. Choke points: a ram here slams the target straight into the opposite wall, and a pendulum swinging along the passage throws them into the next room |

* Walls are generated wherever floor meets stone, so the map in `src/level.js`
  is the single source of truth for collision, rendering, line of sight and the
  minimap.
* Intruders head straight for the Keeper when they can see Wren, and otherwise
  follow a breadth-first flow field through the passages. Breaking line of
  sight and running is how you pull pursuers into a different trap layout.
* No trap may be built on a door tile, so spawn-camping isn't possible.

## 5. Controls (prototype)

| Input | Setup phase | Wave phase |
|---|---|---|
| WASD | Move | Move |
| Mouse (click to capture) / Q E | Camera | Camera |
| Space | Dash | Dash (brief invulnerability) |
| 1–5 / Tab | Select trap | — |
| 1 / 2 / 3 | — | Fire floor / wall / ceiling traps |
| R | Rotate trap | — |
| Left / right click | Place / sell | — |
| Enter | Start wave | — |

**Touch (phones and tablets, enabled automatically):** floating joystick under
the left thumb; right-thumb drag turns the camera; a quick tap on the floor
selects the tile that **Place / Sell** act on; the trap bar is tappable. A
right-hand button grid swaps per phase: **Place, ↻, Sell, Start** in setup and
**Floor, Wall, Ceiling, Dash** in waves, with trigger buttons glowing green when
armed. Phones render at reduced resolution with cheaper shadows.

## 6. Traps

One trap per **layer** (floor, wall, ceiling) per tile, so a floor trap and a
ceiling trap can stack on the same tile, which is the basis of most combos.

| Trap | Layer | Cost | Dmg | Reset | Zone | Effect |
|---|---|---|---|---|---|---|
| Spring Plate | Floor | 30 | 10 | 3.5s | 1 tile | Launch up + ~2 tiles forward; touchdown causes **Hard Landing** |
| Gear Clamp | Floor | 40 | 15 | 6s | 1 tile | Pins for 3s, snapping the target to the tile centre. Any knockback frees them |
| Piston Ram | Wall | 50 | 20 | 4s | 2 tiles out from a wall | Punches ~2.5 tiles away from the wall (lands on tile 3) |
| Pendulum Blade | Ceiling | 60 | 30 | 5s | 1×3 strip | Knocks ~3 tiles along its swing; **Wall Slam** if a wall is closer |
| Iron Weight | Ceiling | 70 | 45 | 7s | 1 tile | Falls after 0.4s; stuns 1.5s. Misses if the target walks off. Pair with a clamp |

**Environmental hits** (Wall Slam 15, Hard Landing 10) count as combo links, so
geometry is part of the trap set.

### Signature combos (all verified in simulation)

* **Passage slam:** a ram on a passage tile hits the target straight into the
  opposite wall (Piston Ram → Wall Slam).
* **Passage sweep:** a pendulum swinging along a passage throws the target into
  the next room.

* **Ram → Clamp → Weight:** ram from the wall onto a clamp 3 tiles out, then drop
  the weight on the pinned target. 107 damage with the chain multiplier, enough
  to kill a thief.
* **Spring → Hard Landing:** a free second hit from any spring plate.
* **Pendulum → Wall Slam:** place a pendulum within 2 tiles of a wall, facing it.

## 7. Combos and scoring

* Each intruder has its own chain. A hit within **3s** of the previous one extends it.
* Damage multiplier: `1 + 0.25 × (hits so far)`, capped at ×3.
* Chain score when it ends: `10 × n(n+1)/2` + **50 per distinct source** beyond
  the first. Long chains grow quadratically and variety beats spamming one trap.
* Kills add the intruder's base score and cogs (Thief 100 pts / 40⚙, Knight
  250 pts / 90⚙).

## 8. Intruders

| Type | HP | Speed | Knockback | Attack | Notes |
|---|---|---|---|---|---|
| Thief | 100 | 3.1 | full | 10 dmg, 0.45s windup | Fast, fragile, the combo-training target |
| Guild Knight | 220 | 2.1 | 50% resisted | 22 dmg, 0.7s windup | Travels half as far. Needs clamps and ceiling traps |

AI: chase the Keeper, stop at melee range, telegraph with a raised-arms windup
and red glow, then strike. The windup is the player's cue to dash.

**Planned:** *Inquisitor* (spots and disarms one armed trap per room),
*Acrobat* (jumps over the first floor trap it steps on), *Sapper* (throws
bombs; can be launched into other intruders), and named story bosses with
room-specific gimmicks.

## 9. Setting and tone

* **Brassmoor:** a gothic manor whose walls hide gears, pistons and counterweights.
  Candlelit stone, brass fittings, cold moonlight through high windows.
* **Wren:** quiet, clever, bound to the house by an unexplained contract
  written in the inventor's hand. The story question is whether Wren protects
  the house or is imprisoned by it.
* **Intruders** have names and reasons (debt collectors, rival inventors, a
  sibling looking for the missing inventor). Some can be spared, which leads to
  branching endings.
* Tone: dark and theatrical with a slapstick edge. Traps are Rube Goldberg
  contraptions, not gore.

## 10. Progression (beyond the prototype)

* **Chapters:** each is a night in a different wing of the manor, built on the
  multi-room layout from v0.2 (2–4 rooms joined by passages).
* **Workshop:** spend cogs and salvaged parts to unlock and upgrade traps
  (shorter reset, bigger zone, elemental variants such as steam and sparks).
* **Room features:** fixed hazards per room (chandeliers, stairs, furnaces,
  bookcases that topple) that act as free combo links.
* **Ratings:** per-room grades for combo length, variety and damage taken.

## 11. Prototype scope (this repo, v0.2)

Built and playable:

* Three rooms and two passages (see §4), with per-area lighting, two spawn doors,
  a minimap and a current-room label.
* Third-person Keeper with an over-the-shoulder camera that tilts over walls
  instead of clipping, plus a dash.
* Five traps with placement ghost, zone preview, rotation, selling and status lamps.
* Two intruder types with pathfinding, physics knockback, wall slams, hard
  landings, restraint and stun.
* Per-intruder combo chains with on-screen chain readout and scoring.
* Four waves, then victory or defeat screens.
* Synthesized sound effects (no audio assets).

Not yet: room hazards, new intruder types, workshop/upgrades, story, saving, gamepad, real models.

## 12. Technical notes

* **Stack:** Three.js + Vite, plain ES modules, no other runtime dependencies.
* **Fixed timestep:** simulation runs at 60 Hz with up to 12 sub-steps per
  rendered frame, so knockback distances are identical at any frame rate.
* **Layout:**
  * `src/config.js`: all tuning numbers (traps, intruders, waves, combo rules)
  * `src/combo.js`: pure combo/scoring logic
  * `src/traps.js`: trap visuals, zones, firing and reset animation
  * `src/intruder.js`: AI state machine and physics
  * `src/game.js`: phase flow, placement, triggering and callbacks
  * `src/player.js`: Keeper movement and third-person camera
  * `src/level.js`: the tile map, wall collision, line of sight and pathfinding (pure logic)
  * `src/room.js`: renders the level (floors, generated walls, doors, lights)
  * `src/hud.js`, `src/audio.js`, `src/characters.js`
* **Tests:** `npm test` runs headless simulations. Traps and intruders run without
  a renderer, so combo geometry is regression-tested.

## 13. Decisions and open questions

Decided:

* **Names:** the manor is **Brassmoor** and the Keeper is **Wren**.
* **Triggering:** traps fire by layer (`1` floor, `2` wall, `3` ceiling), and
  only armed traps with a target fire.
* **Placement:** setup phase only. Waves are purely about kiting and timing.

Open:

1. How much story: light framing between nights, or a branching narrative?
2. Art direction for real assets: stylized low-poly, or painterly textures on simple shapes?
3. Room hazards (furnace in the Boiler Room, toppling statues in the Gallery):
   fixed per room, or placeable like traps?
