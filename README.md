# Bayanihan: Disaster Rescue

A 2D top-down disaster-response game about a Filipino youth volunteer taking a
bangka out into a flooded coastal barangay — pulling people off rooftops, out of
the current and out from behind debris, and ferrying them to the evacuation
center before the water takes the low houses.

Targets **SDG 11 (Sustainable Cities and Communities)**, specifically disaster
resilience and community preparedness.

BSIT capstone · University of Perpetual Help System Laguna.

---

## Running it

Open **`index.html`** in a browser. That is the entire install step — no build,
no server, no dependencies. Plain HTML5 + CSS3 + vanilla JS with a Canvas2D
arena.

Because it must run from `file://`, the build deliberately avoids what that
origin blocks:

* classic `<script>` tags only — ES modules are refused by CORS on `file://`
* no `fetch()` of local JSON — the barangay layouts are generated in
  `js/maps.js` from each mission's seed instead of loaded from
  `assets/maps/*.json`
* **no `localStorage` anywhere** — settings and progress live in memory for the
  session. `js/state.js` marks the two `>>> PERSIST <<<` points where a
  persistence layer would slot in.

Google Fonts are linked (Press Start 2P for the display face) but every rule has
a real fallback stack, so it renders correctly offline.

---

## ⚠️ The reference art is from a different project

`prompt.md` describes *Bayanihan: Disaster Rescue* and points at
`/BAYANIHAN_ELEMENTS/` for sprites. That folder is the renamed
`TERRAQUA_ELEMENTS/` from the previous capstone concept, and everything in it is
**Terraqua Clash** art:

| File | What it actually is |
|---|---|
| `2.png` | Sunny beach background, 1920×1080 |
| `3.png` | A logo reading "TERRAQUA CLASH" |
| `4.png` | Polar bear, penguin, shiba, brown bear |
| `5.png` – `10.png` | Buttons: PLAY NOW, MULTIPLAYER LOBBIES, CHARACTER SELECT, SURVIVAL GUIDE, SETTINGS, QUIT |
| `REFERENCE (SCREENSHOT).png` | The composite title screen |

`GameOverview_Screenshot.png` is likewise the Terraqua Clash overview (SDG 14/15,
3D physics multiplayer animal arena).

Shipping a cartoon polar bear and a "TERRAQUA CLASH" wordmark inside a Filipino
flood-rescue capstone would be wrong, so per §31/§33 of the brief the build takes
the **palette and composition** from that reference and draws everything else
procedurally:

* **Palette sampled from the reference** — sky `#BFE7FB→#7FC4E8`, mountains
  `#8FC3E8 / #5FA3D9 / #3F87C9`, sea `#1489B4 / #2BB4D4 / #5FD6E6`, foam
  `#E4FAFF`, sand `#F7CE6E / #E9B44E`, foliage `#35A83A / #1F7B2C`, trunk
  `#C98A52`, rock `#5D6E79`; plus the brief's amber button family
  `#F6A623` with a `#9E5E08` bevel and `#4A2A12` text.
* **Title scene** — inline SVG in `index.html`: palms and foliage upper-left, a
  *bahay kubo* carried by five villagers upper-right, beach and water across the
  bottom third, with floodwater lapping over the sand.
* **Every game sprite** — boat, residents, roofs, trees, debris, live wires,
  evacuation center and all eight supply icons are drawn on canvas in
  `js/assets.js`.

The previous Terraqua Clash build is preserved on the local branch
`terraqua-clash-archive` and at its own remote (`terraqua-archive`).

---

## Structure

```
index.html                 all six screens (SPA-style switching) + floaters
css/
  styles.css               palette vars, typography, buttons, floaters
  screens.css              per-screen layout
js/
  state.js                 session state, seeded RNG, math helpers
  audio.js                 Web Audio synthesis — no audio files ship
  assets.js                procedural sprite library + image-loader seam
  supplies.js              the eight supplies and their field effects
  missions.js              the three missions and every tuning number
  maps.js                  seeded barangay generator + tile rules
  rescue.js                roster, triage tags, pickup rules, timers
  hud.js                   seats, water gauge, hotbar, prompts, radio arrow
  render.js                the whole paint pass
  game.js                  lifecycle, fixed-timestep loop, boat physics, weather
  report.js                after-action scoring + preparation linkage
  preparation.js           supply grid, capacity slots, loadout state
  mission-select.js        three cards, gated progression
  landing.js               title screen wiring + rain
  main.js                  router, floaters, settings, touch, boot
assets/maps/               README only — layouts are generated, see above
assets/audio/              README only — all audio is synthesised
BAYANIHAN_ELEMENTS/        delivered reference art (not shipped as sprites)
```

---

## The loop

1. **Mission Select** — three missions, played in order, each unlocking the next.
2. **Preparation Phase** — 4 slots on Mission 1, 5 on the later two, and eight
   things worth taking. You are never blocked from packing badly.
3. **The mission** — pilot the bangka, take people aboard three at a time, ferry
   them to the evacuation center, race the rising water.
4. **After-Action Report** — scores the run and names the link between what you
   packed and what happened. Retry returns to the Preparation Phase, not into
   the mission.

**Rescue conditions.** On a roof: just get there. In open water: needs the
**Salbabida**. Behind debris: needs the **Lubid**. Injured: needs the **Botika**,
as a two-second hold. Nothing is a hard fail — a missing item makes a run much
harder, not impossible.

**The clock is the flood.** Instead of a countdown, the waterline climbs and
progressively submerges the low roofs. A roof floods visibly from `elev - 0.22`
and goes under at `elev`, so there is roughly 45 seconds of warning before
anyone standing on it is lost.

**Controls.** WASD or arrows steer · `Shift` sprints · `Space` / `E` is the
context action · `1`–`5` use packed supplies · `Esc` pauses. Touch controls
(virtual stick + action buttons) appear automatically on touch devices.

---

## Status

Every screen, system and module described above is implemented and wired.

**Known issue — boat collision wedging.** A headless simulation harness
(`node` + a BFS-pathfinding pilot driving the real game modules) shows the boat
jamming against geometry: 150–190 stuck events per mission and an average speed
of 25–49 px/s against a 178 px/s cap. Missions therefore tend to end on the
flood timer with low rescue counts rather than on a cleared roster, and the
2–4 minute target is not yet met. `unstick()` in `js/game.js` recovers the hull
when it ends a step *inside* geometry, but something is still stalling it — this
was mid-diagnosis when the build was committed and is the next thing to fix.

Balance numbers, roster composition and supply gating are all verifiable by
re-running that harness.
