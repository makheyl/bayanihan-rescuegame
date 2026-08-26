# Claude Code Build Prompt — Terraqua Clash: Landing Page + Core Gameplay Prototype

## 1. Project Context

Terraqua Clash is a 3D physics-based multiplayer animal survival arena game (BSIT capstone project, UPHSL). It targets **SDG 14 (Life Below Water)** and **SDG 15 (Life on Land)**. The signature hook is a real-time **Tide-Shift Mechanic**: sections of the arena flip between land and water mid-round, so land and water animals must keep adapting to survive. Pitch angle: most survival games ignore real-world environmental issues like habitat loss and biodiversity decline; this game embeds that awareness directly into gameplay instead of static text-heavy materials.

## 2. Required Input Assets (place these before running this prompt)

| Purpose | Expected path |
|---|---|
| Landing page design mockup | `/TERRAQUA_ELEMENTS/REFERENCE (SCREENSHOT).png` |
| Animal roster / element art (all individual `.png` files) | `/TERRAQUA_ELEMENTS/*.png` |
| Gameplay overview / reference screenshot | project root, e.g. `/gameplay-overview.png` (check the root folder for the exact filename) |

**Step zero, before writing any code:** open and visually inspect the landing page design (`/TERRAQUA_ELEMENTS/REFERENCE (SCREENSHOT).png`) and the gameplay overview screenshot at the project root, and list every `.png` file inside `/TERRAQUA_ELEMENTS/` other than `REFERENCE (SCREENSHOT).png`. Extract the color palette, typography, and exact button labels/count/placement from the landing page design, and treat each other file in `/TERRAQUA_ELEMENTS/` as one roster entry (species + visual style) — the filename is a reasonable first guess at the animal's name unless the art itself makes it obvious otherwise. The fallback button list and fallback animal roster in this document are only for anything the reference assets don't make clear — prefer what's actually in `/TERRAQUA_ELEMENTS/` over these fallbacks.

## 3. Scope of This Build

1. A fully-styled, responsive landing page matching the provided design.
2. **Every button on the landing page must lead somewhere real** — a full page (e.g. Terrain Select) or an in-page floating panel/modal ("floater"). No dead buttons.
3. A playable core gameplay prototype (single browser build, canvas-based) reachable from the "Play" button.

## 4. Tech Stack & Constraints

- Plain HTML5 + CSS3 + vanilla JS. No build step — must run by opening `index.html` directly in a browser.
- Canvas2D for the arena (top-down or 3/4 view). This keeps physics and collision simple and fast to iterate on. Do **not** start with a 3D engine — get the 2D physics and feel right first; a Three.js pass can come later if the team wants closer-to-3D visuals.
- No backend for this phase. "Multiplayer" = **local multiplayer**, same-keyboard split controls (2–4 players: WASD/Space for P1, Arrow keys/Enter for P2, etc., plus gamepad support if easy). Structure the game loop and state so a networked layer (WebSocket / Unity Gaming Services / etc.) could be slotted in later without a full rewrite — but don't build networking now.

## 5. Landing Page Requirements

- Recreate the hero section: game logo/title "Terraqua Clash", tagline, background art (from the design asset).
- For every button present in the reference design, wire it to something functional. Suggested defaults if the design's exact button set is unclear:
  - **Play** → Terrain Select screen → gameplay canvas
  - **How to Play / Controls** → floater listing WASD movement, the push mechanic, powerups, tide-shift, and the round timer
  - **Choose Your Animal** → floater or page with a grid of animal cards (one per roster entry) with a selection state
  - **About / SDG Info** → floater summarizing the SDG 14/15 concept and the Tide-Shift mechanic
  - **Settings** (if present) → floater for volume / control remap
  - **Credits / Team** (if present) → floater
  - Any button in the design not covered above: infer its purpose from its label/icon and still give it a working floater or page.

## 6. Terrain Selection Screen

- A grid of selectable habitats/platforms — e.g. Forest, Coral Reef, Arctic Tundra, Savanna, Wetland.
- Each terrain has a distinct visual theme, hazard layout, and starting land/water split (before Tide-Shift begins altering it mid-match).
- Confirming a terrain choice loads that arena and starts the match.

## 7. Animal Roster

- Populate directly from every `.png` in `/TERRAQUA_ELEMENTS/` **except** `REFERENCE (SCREENSHOT).png` (that one is the landing page design reference, not an animal) — one roster entry per remaining file.
- Fallback, only if that folder is empty or unreadable: a small SDG-appropriate mixed roster spanning land and water — e.g. Lion, Elephant, Eagle (land/air) and Shark, Sea Turtle, Otter (water). Six animals is enough for a prototype.
- Each animal needs a distinct sprite and simple base stats (speed, push power, size) so the choice matters — no need for a deep stat system.

## 8. Core Gameplay Spec

**Arena / platform**
The platform is the animals' habitat. It isn't freely edited by players by hand — it's dynamically reshaped in real time by the Tide-Shift Mechanic below. *(Check the gameplay reference screenshot before finalizing this — if it shows literal player-driven platform building/editing, follow that instead of this assumption.)*

**Movement & "combat"**
- WASD (or arrow keys for other local players) to move each player's animal.
- Colliding with another animal applies a push/knockback force, scaled by the pusher's push stat and current speed. There's no direct damage system — the entire "combat" loop is pushing rivals off the platform or into hazards (sumo / Fall-Guys style).
- Falling off the platform edge eliminates that animal for the round.

**Timer**
- Visible round countdown. When it hits zero, the surviving animal(s) — or whoever has the longest survival time — win. Optionally add a shrinking safe zone or escalating hazard near the end to force a conclusion.

**Powerups**
- Spawn periodically on the platform as pickups. Keep the effect list small (3–4 types) for the prototype: e.g. Speed Boost, Size/Push Boost, Shield (brief knockback immunity), Freeze (briefly roots a rival).

**Weather / Tide-Shift**
- The signature system: on a timer or at random, sections of the platform flip between land and water.
- Water sections should slow/penalize land animals (and carry a risk of elimination if they can't "swim") while giving water animals a speed/agility edge there — and the reverse on land.
- Add a simple visual weather layer tied to this (rain overlay, screen darkening, wind particles), both for atmosphere and optionally as a light secondary effect (e.g. rain slightly reducing traction or visibility for everyone).

## 9. Suggested File Structure

```
project/ (Terraqua Clash)
  gameplay-overview.png       — gameplay reference screenshot (exact filename may vary)
  index.html                 — landing page
  /css/styles.css
  /js/
    landing.js                — button/floater wiring
    terrain-select.js
    game.js                    — main loop, physics, tide-shift, powerups, timer
    animals.js                 — roster + stats
  /TERRAQUA_ELEMENTS/
    REFERENCE (SCREENSHOT).png — landing page design reference (not shipped as a game asset)
    *.png                      — animal roster art (source of truth, referenced above)
  /assets/
    /terrains/
```

## 10. Acceptance Checklist (self-verify before calling this done)

- [ ] Every visible button on the landing page opens something — no dead buttons
- [ ] Terrain Select lets you pick a habitat, and the choice visibly changes the arena you load into
- [ ] At least 2 players can be controlled simultaneously on one keyboard and can push each other off the platform
- [ ] Timer counts down and the match resolves when it hits zero
- [ ] At least 3 powerup types spawn, are pickable, and visibly change gameplay
- [ ] Tide-Shift visibly converts sections of the platform between land/water at least once per match, with a matching weather cue
- [ ] Everything runs by opening `index.html` directly in a browser — no build step required
