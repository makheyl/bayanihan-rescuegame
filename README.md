# Terraqua Clash — Landing Page + Core Gameplay Prototype

A physics-based multiplayer animal survival arena built around a real-time
**Tide-Shift Mechanic**, targeting **SDG 14 (Life Below Water)** and
**SDG 15 (Life on Land)**.

BSIT capstone · University of Perpetual Help System Laguna · pilot group: UPHSL student groups.

---

## Running it

Open **`index.html`** in a browser. That is the whole install step — no build,
no server, no dependencies. Plain HTML5 + CSS3 + vanilla JS.

Because it must run from `file://`, the build deliberately avoids anything that
origin blocks:

* classic `<script>` tags only — ES modules are refused by CORS on `file://`
* no `fetch()` of local JSON; all data lives in JS
* state moves between pages in the **URL query string**, with `localStorage`
  only as a convenience mirror (it can throw on `file://` origins)

Google Fonts are linked but every rule has a real fallback stack, so it looks
correct offline too.

---

## ⚠️ Asset finding — `/TERRAQUA_ELEMENTS/` is not an animal roster

The build brief assumed each `.png` in `/TERRAQUA_ELEMENTS/` was one animal.
It is not. Measuring the files shows all nine are **1920 × 1080 transparent
layers of the landing page**, each with its content already at its final
composite position:

| File | Alpha bounding box | What it actually is |
|---|---|---|
| `2.png` | full frame | beach background |
| `3.png` | 494,17 · 890×380 | "TERRAQUA CLASH" logo |
| `4.png` | 2,274 · full width | the four characters |
| `5.png` | 789,448 · 343×84 | **PLAY NOW** button |
| `6.png` | 790,547 · 337×76 | **MULTIPLAYER LOBBIES** button |
| `7.png` | 793,638 · 335×76 | **CHARACTER SELECT** button |
| `8.png` | 793,728 · 334×78 | **SURVIVAL GUIDE** button |
| `9.png` | 858,827 · 200×68 | **SETTINGS** button |
| `10.png` | 789,918 · 346×62 | **QUIT** button |
| `REFERENCE (SCREENSHOT).png` | full frame | the composite |

Two consequences:

1. **The landing page is pixel-exact**, because it simply stacks the delivered
   layers and crops each button out of its own layer with sprite
   `background-size` / `background-position` maths. The precomputed values are
   in `css/styles.css` under `.menu-btn`.
2. **The roster was built from the characters actually drawn in the art** —
   the polar bear, penguin, shiba and brown bear in `4.png`, plus the raccoon
   and husky visible in the button icons — topped up with two SDG-14 species
   from the brief's fallback list so land and water are evenly matched. Each
   card is labelled with where its character came from.

The palette in `css/styles.css` is sampled directly from these layers, so every
page matches the landing art rather than approximating it.

---

## Structure

```
index.html                landing page (layered art + floaters)
character-select.html     roster grid, one seat per player
terrain-select.html       habitat picker
game.html                 the arena
css/
  styles.css              theme tokens, landing, shared UI
  game.css                arena shell, HUD, overlays
js/
  core.js                 utils, settings, match hand-off, SFX, floaters
  animals.js              roster + the shared creature renderer
  terrains.js             five habitats, height fields, terrain painting
  powerups.js             the four pickups
  landing.js              landing-page wiring
  character-select.js
  terrain-select.js
  game.js                 loop, physics, tide, hazards, AI, render
TERRAQUA_ELEMENTS/        design layers (see above)
```

No `/assets/` folder: terrain previews and every creature are drawn
procedurally on canvas, and all audio is synthesised, so the build ships with
no binary assets beyond the supplied design layers.

---

## Controls

| Player | Move | Dash |
|---|---|---|
| 1 | `W` `A` `S` `D` | `Space` |
| 2 | Arrow keys | `Enter` |
| 3 | `I` `J` `K` `L` | `U` |
| 4 | Numpad `8` `4` `5` `6` | Numpad `0` |

A connected gamepad claims its seat automatically — left stick moves, bottom
face button dashes.

In a match: `P` / `Esc` pause · `R` restart · `M` mute.

---

## How the game works

**No health, no damage.** The entire fight is positioning: shove rivals into
deep water, or strand them in a biome that drains them.

### Tide-Shift

The arena is not a flat platform with random puddles. Every tile has a fixed
**elevation** and the match has a single **sea level** that rises and falls on
a cycle. Land is whatever is currently above that line, so the whole coastline
moves at once — high ridges stay dry longest, low flats flood first, and the
map has real geography you can learn.

Height fields are normalised to **percentile rank**, which is why each habitat
can *declare* its land/water split (`mix: { deep, landMid, tideSwing }`) and
get it exactly, instead of it emerging by luck from sine coefficients. The
island shape stays organic because the remap preserves tile ordering.

For the last 30 seconds the tide *floor* climbs permanently and the island
erodes from the edges inward. That is the shrinking safe zone, and it doubles
as the SDG 14 message: the ground disappears as the sea rises.

### Classes

| Class | On land | In water |
|---|---|---|
| Land | full speed, recovers | slow, drains |
| Water | slow, drains | fastest, recovers |
| Amphibious | slightly reduced, recovers | normal, recovers |

Stamina drains at 7.2/s — a full bar lasts ~14s, deliberately longer than the
fastest tide cycle (9s), so being caught out is a scramble rather than an
unanswerable loss. Empty it and you are eliminated, so a shove that strands
someone is a kill in slow motion.

### Habitats

| Habitat | SDG | Land at mid tide | Tide | Hazard |
|---|---|---|---|---|
| Coral Reef | 14 | 34% | 9s | rip currents |
| Mangrove Delta | 14 + 15 | 50% | 12s | root pillars |
| Arctic Ice Shelf | 14 | 66% | 14s | floes crumble permanently |
| Savanna Waterhole | 15 | 64% | 15s | geysers |
| Rainforest Basin | 15 | 52% | 11s | falling timber |

### Power-ups

Speed Surge · Tidal Slam · Kelp Shield · Deep Freeze. Small on purpose so each
reads instantly on screen.

---

## Where networked play would slot in

The brief asked for local multiplayer now, structured so a networked layer can
be added later without a rewrite. In `js/game.js` the loop is
**`readInput` → `simulate` → `render`**, and all player state lives in plain
objects in `state.players`. A network layer replaces `readInput` and reconciles
`state.players`; the simulation and renderer do not need to change. The fixed
1248 × 702 world (physics never depends on canvas size) and the deterministic,
seeded height fields both exist to make that step viable.

---

## Verification

The prototype was tested headlessly rather than by eye alone — a DOM/Canvas
stub runs the real loop in Node, plus real browser screenshots of every page.
Bugs this caught and that are now fixed:

* **Stamina sign inversion.** The class table documented "negative
  regenerates" but the sim did `stamina += sta * dt`, so every regen value
  drained instead. Every animal died in ~4 seconds regardless of play. The
  table now uses the natural convention: `sta` is simply the rate of change.
* **Arctic had 3% water and savanna 4%,** leaving water animals dead on
  arrival. Fixed by the percentile normalisation described above.
* **Class-blind spawns** dropped water animals on the driest tile on the map.
* **The island rendered as a chainmail lattice** — land is a union of
  overlapping circles, and `stroke()` on such a path outlines *every* circle
  rather than the silhouette. Outlines are now drawn by filling slightly
  larger copies of the path behind it.
* **Stat bars were invisible** — `.stat__fill` is a `<span>`, and an inline
  element ignores `width`/`height`.

### Known limitations

* Rounds between four AI opponents can end well before the timer (12–80s
  observed); the AI hunts edges aggressively. Human play is slower.
* AI is a steering-and-scoring heuristic, not a planner — it will not set up
  multi-step traps.
* The arena is Canvas2D top-down, per the brief's instruction to get the
  physics feel right before attempting a 3D pass.
