# deceptive-traps

**Brassmoor: Deceptive Traps** is a browser-based 3D trap-defense game. You play a
Keeper who cannot fight: lure intruders onto the manor's clockwork traps and chain
them into combos.

An original game inspired by the PlayStation-era trap-defense genre. See
[`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # headless combo/physics tests
npm run build    # static build in dist/
```

## How to play

1. **Setup:** walk the room, aim the crosshair at a tile, pick a trap with
   `1`–`5`, rotate with `R`, place with left-click (right-click sells for a
   full refund). Press `Enter` to start the wave.
2. **Wave:** intruders hunt you. Kite them onto trap zones and fire traps by
   layer: `1` floor, `2` wall, `3` ceiling. A green lamp means a trap has a
   target. `Space` dashes through attacks.
3. Chain hits within 3 seconds for damage multipliers and big score.

The manor has three rooms (Grand Foyer, Boiler Room, Gallery) joined by narrow
passages, and intruders come in through two doors. Break line of sight and run
to drag pursuers into a different trap layout.

Try this opener: a **Piston Ram** on a Foyer wall, a **Gear Clamp** three tiles
in front of it, and an **Iron Weight** above the clamp. Fire `2`, then `1`, then `3`.
In a passage, a ram slams intruders straight into the opposite wall.
