# tools/ — verification harness

Development-only. **Nothing here ships with the game** and `index.html` never
loads any of it. The game itself still runs by being opened directly in a
browser, with no build step and no Node.

These exist so the balance claims in the top-level README can be re-checked
rather than taken on trust — useful if a panelist asks "how do you know a
mission takes two to four minutes?"

Requires Node (any recent version). Run from the project root.

---

## `bench.js` — balance measurement

```
node tools/bench.js . 5
```

Loads the real game modules (`js/state.js`, `maps.js`, `rescue.js`, `game.js`, …)
into a stubbed DOM, then plays every mission with a scripted pilot and reports
the median of N runs: completion time, residents saved, how often the roster was
cleared before the flood topped out, score, ferry trips, average boat speed and
the number of times the boat got stuck.

The second argument is the project root; the third is the repeat count (default
5). Repeats matter because the simulation carries real randomness — collisions,
weather and the overboard roll.

Typical output:

```
-- Pagbaha sa Barangay / The Water Rises  (4 slots, 205s rise, dark 0, 10 residents) --
   recommended       100s  saved 10/10  cleared 5/5  score  1450  trips 3  avg 154px/s  stuck 0
   EMPTY pack        198s  saved  6/10  cleared 5/5  score   800  trips 2  avg 151px/s  stuck 1
```

**Read the times as a floor, not an average.** The pilot routes with
breadth-first search over the tile grid and reacts instantly, so it is faster
than a person. A human playing reasonably lands meaningfully above these
numbers, and every mission is capped by its own flood timer regardless
(205 / 200 / 195 seconds).

## `pilot.js` — the scripted player

Used by `bench.js`. Chooses a triage-weighted target, paths to the water tile
beside it, ferries at capacity, and sweeps a patrol grid when it has nothing it
can legally rescue.

One rule matters for honest measurement: **the pilot may only navigate toward
residents it has actually found.** Letting it read unfound residents straight
out of the roster made the flashlight worthless in the numbers and hid the
entire difficulty of Mission 2.

## `domcheck.js` — static wiring check

```
node tools/domcheck.js .
```

Cross-checks every `getElementById` in `js/` against the ids in `index.html`,
verifies each `<script>` and `<link>` resolves, flags any JS file on disk that
`index.html` never loads, and confirms all six screens and all five floaters
exist.

It reports one known false positive: `#supplyGrid .scard`. Those cards are
created at runtime by `js/preparation.js`, so they are correctly absent from the
static HTML.
