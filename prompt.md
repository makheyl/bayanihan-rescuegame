# Claude Code Build Prompt — Bayanihan: Disaster Rescue: Landing Page + Core Gameplay Prototype

## 1. Project Context

**Bayanihan: Disaster Rescue** is a 2D top-down disaster-response game (BSIT capstone project, UPHSL). It targets **SDG 11 (Sustainable Cities and Communities)**, specifically disaster resilience and community preparedness.

The premise: the player is a Filipino youth volunteer in a coastal barangay hit by a typhoon flood. When the water rises, the youth take a boat out and rescue stranded residents — pulling people off rooftops, hauling them out of the current, searching for reported missing persons — and ferry them back to the evacuation center. Before every mission there is a **Preparation Phase** where the player packs limited boat capacity with rescue supplies (lifebuoy, first-aid kit, flashlight, rope, drinking water, radio). What you packed determines which rescues you can actually complete.

The title is drawn from *bayanihan* — the Filipino tradition of the community physically carrying a neighbor's house together. That's the thesis of the game: **rescue is a community act, and preparation is what makes it possible.**

Pitch angle: Philippine disaster-preparedness education is delivered almost entirely through text-heavy modules, seminars, and drills that students disengage from. This game teaches the same content — go-bag contents, triage priority, evacuation procedure, the cost of being unprepared — through a loop the player actually feels, because a missing flashlight means a missing person you don't find in time.

**Design mandate: keep it fun and keep it short.** Target a full playthrough of ~10–15 minutes across 3 missions, each mission 2–4 minutes. This is a vertical slice, not a campaign. Snappy controls, fast restarts, immediate feedback. If a system adds more than a minute of setup for the player, cut it.

## 2. Required Input Assets (place these before running this prompt)

| Purpose | Expected path |
|---|---|
| Landing page / title screen design mockup | `/BAYANIHAN_ELEMENTS/REFERENCE (SCREENSHOT).png` |
| Sprite art — boat, residents, supplies, hazards, tiles (all individual `.png` files) | `/BAYANIHAN_ELEMENTS/*.png` |
| Gameplay overview / reference screenshot, if one exists | project root, e.g. `/gameplay-overview.png` (check the root folder for the exact filename) |

**Step zero, before writing any code:** open and visually inspect the title screen design (`/BAYANIHAN_ELEMENTS/REFERENCE (SCREENSHOT).png`) and any gameplay overview screenshot at the project root, then list every `.png` file inside `/BAYANIHAN_ELEMENTS/` other than `REFERENCE (SCREENSHOT).png`.

From the title screen design, extract:
- the exact **color palette** (the reference is a warm tropical coastal scene — grass green, sand, teal shallow water, and amber/orange buttons with dark brown text and a darker amber bottom-bevel),
- the **typography** (the reference uses a blocky pixel/monospace display face for the title and button labels — use a bitmap-style webfont or a monospace fallback, letter-spaced, never a generic sans),
- the **exact button labels, count, and vertical placement** (the reference shows three center-stacked buttons: **PLAY**, **SETTINGS**, **EXIT**),
- the **scene composition** (palm trees and foliage upper-left, a *bahay kubo* being carried by a group of villagers upper-right, beach and water across the bottom third).

Treat every other `.png` in `/BAYANIHAN_ELEMENTS/` as a game asset and infer its role from the filename and the art itself — boat, resident/NPC, supply item, debris, rooftop, water tile, evacuation center, and so on. **Prefer what's actually in `/BAYANIHAN_ELEMENTS/` over the fallback lists in this document.** The fallbacks below exist only for whatever the reference assets don't cover.

If an asset for something is missing, draw it procedurally on the canvas in the reference palette rather than shipping a broken image link or an empty rectangle.

## 3. Scope of This Build

1. A fully-styled, responsive landing page that recreates the provided title screen design.
2. **Every button on the landing page must lead somewhere real** — a full screen (e.g. Mission Select) or an in-page floating panel/modal ("floater"). No dead buttons.
3. A **Preparation Phase** screen where the player packs limited-capacity supplies before launching.
4. A playable **rescue mission prototype** (single browser build, canvas-based) reachable from PLAY, containing at least the three mission types described in §8.
5. An **After-Action Report** results screen that scores the run and ties the score back to the preparation choices.

## 4. Tech Stack & Constraints

- Plain HTML5 + CSS3 + vanilla JS. No build step — must run by opening `index.html` directly in a browser.
- **Canvas2D, top-down view** for the mission arena. No 3D engine, no physics library. Boat movement is simple velocity + drag + current vectors; that is enough and it iterates fast.
- No backend, no accounts, no server. Persist settings and best scores in-memory for the session only (do **not** use `localStorage` — it is unavailable in some sandboxed preview contexts; keep state in a plain JS module and note in a comment where a persistence layer would slot in).
- Single-player. Structure the game state (`missionState`, `roster`, `inventory`) as plain serializable objects so a co-op or leaderboard layer could be added later without a rewrite — but **do not build networking now**.
- Controls: WASD **and** arrow keys both move the boat, `Space` / `E` is the context action (rescue, pick up, drop off), `1`–`4` uses the corresponding packed supply, `Esc` pauses. Add on-screen touch controls (virtual stick + action button) that appear only on touch devices.
- Target 60fps with a fixed-timestep update and interpolated render. Use `requestAnimationFrame` with an accumulator; do not tie physics to frame rate.
- Audio via Web Audio API only, all synthesized or from `/assets/audio/` if files exist. Never autoplay before a user gesture — start the audio context on the first click.
- Accessibility: all floaters are keyboard-navigable and closable with `Esc`; text contrast passes against the amber/green palette; nothing communicates critical state by color alone (a flooded tile also gets a wave pattern, an injured resident also gets an icon).

## 5. Landing Page Requirements

Recreate the title screen from the reference: the full-bleed coastal illustration background, the "Bayanihan: Disaster Rescue" title in the pixel display face with a soft outline/shadow so it reads against the sky, and the three center-stacked amber buttons with rounded corners, dark brown labels, and a bottom bevel that flattens on `:active`. Buttons get a subtle hover lift and a click sound.

Wire every button:

- **PLAY** → Mission Select screen → Preparation Phase → gameplay canvas
- **SETTINGS** → floater with master / SFX / music volume sliders, a control-scheme reminder, and a "Reduce motion" toggle that dampens screen shake and rain particles
- **EXIT** → **not a dead end.** Show a confirmation floater ("Umuwi na? / Leave the barangay?"). Confirming swaps the page to a farewell card with the SDG 11 message, the team credits, and a "Bumalik / Return" button back to the title. A web page can't close itself unopened, so never call `window.close()` and hope — always render this screen.

Add two further entry points if the reference art has room for them without breaking the composition; if not, surface them from a small icon row in a corner:

- **PAANO MAGLARO / HOW TO PLAY** → floater covering movement, the context action, supply use, boat capacity, the rising-water timer, and drop-off at the evacuation center
- **TUNGKOL DITO / ABOUT** → floater summarizing SDG 11, the bayanihan concept, and the real go-bag checklist the Preparation Phase is modeled on

Any button present in the design and not covered above: infer its purpose from its label or icon and still give it a working floater or screen.

**Bilingual flavor:** use Filipino terms as the primary label with English underneath in smaller text for the rescue-specific nouns (bangka/boat, bahay kubo, evacuation center/evacuation site, sagip/rescue). Keep all instructional and UI-critical text readable in English so a non-Filipino panelist can follow a live demo.

## 6. Mission Select Screen

A card grid of three missions, played in order, each unlocking the next. Each card shows a name, a one-line situation brief, the disaster condition, and a difficulty pip.

1. **Pagbaha sa Barangay / The Water Rises** — daytime flood. Residents are stranded on rooftops and in trees. Teaches movement, boat capacity, and drop-off.
2. **Ang Nawawala / The Missing** — dusk, low visibility, heavy rain. A radio report names residents unaccounted for; the player has to search the flooded blocks to find them. Teaches the flashlight, the radio, and search under time pressure.
3. **Ang Huling Sakay / The Last Boat** — night, water rising fastest, the most residents, live-wire and debris hazards at their densest. Everything combined, as a finale.

Selecting a mission does **not** launch it directly — it advances to the Preparation Phase for that mission. Each mission card should preview the recommended supplies without dictating them, so the player still makes a real choice.

## 7. Preparation Phase (Paghahanda)

This is the game's second core system and it must feel like a real decision, not a menu you click through.

- The player sees a **boat with a limited supply capacity** — start at **4 slots** for Mission 1, and let later missions grant 5. Show capacity as visible slots on the boat, not as a number in a corner.
- Present a **grid of supply cards**, each with art, a Filipino + English name, and a one-line explanation of what it does in the field. Clicking adds or removes it from the boat.
- Supply set (six to eight items, so the choice bites):

| Supply | Field effect |
|---|---|
| **Lifebuoy / Salbabida** | Required to rescue a resident who is already in open water rather than on a roof |
| **First-aid kit / Botika** | Required to stabilize an injured resident before they can board; without it they can only be marked, not rescued |
| **Flashlight / Flashlight** | Widens the visibility cone in dusk/night missions; without it, night search is nearly blind |
| **Rope / Lubid** | Required to pull residents trapped behind debris or on a collapsing structure |
| **Drinking water / Tubig** | Restores boat stamina/sprint; lets you push against strong current for longer |
| **Two-way radio / Radyo** | Pings the direction of the nearest unfound resident every ~20s — the search assist for Mission 2 |
| **Raincoat / Kapote** | Reduces the rain visibility penalty for everyone in the boat |
| **Food packs / Relief goods** | Bonus score per delivered resident; costs a slot that could have been a rescue tool |

- **The lesson is the constraint.** Leaving the flashlight behind on the night mission has to visibly cost the player, and the After-Action Report must name that link explicitly: *"You left the flashlight. Two residents were not found in time."* Never block the player from packing badly — let them, then show them.
- A "Suggested pack" button auto-fills a sensible loadout so a panelist demoing the game can skip ahead, but the player's own choices always override it.
- Confirming the pack launches the mission.

## 8. Core Gameplay Spec

**The arena**

A top-down flooded barangay on a tile grid — roofs, treetops, road segments now underwater, debris, and the **evacuation center** (an elevated covered court or school) marked clearly at one edge. The player pilots the bangka across water tiles only; solid tiles are obstacles. Camera follows the boat with a soft lerp and clamps to the map bounds.

**Movement**

- WASD / arrows apply thrust in the facing direction with momentum and water drag — the boat should feel like a boat, gliding a little after you release, not stopping dead.
- `Shift` sprints, draining a stamina bar that refills slowly and refills instantly from a packed **Tubig**.
- Current vectors on certain tiles push the boat; visualize them as flowing arrows or streaks in the water so they are readable before they are felt.
- Colliding with debris at speed staggers the boat briefly and, if you are carrying residents, risks one falling in — recoverable, but it costs time.

**Rescue loop (the heart of the game)**

1. Approach a resident and press the context action to bring them aboard.
2. Different residents require different conditions — on a roof: just approach; in open water: requires **Salbabida**; behind debris: requires **Lubid**; injured (flagged with an icon): requires **Botika** first, as a ~2 second hold.
3. **Boat capacity is 3 residents.** When full, you must return to the evacuation center and drop off before rescuing more. This ferry rhythm is the mission's pacing engine — do not remove it.
4. Dropping off awards score and plays a small celebration (villagers wave the boat in).

**Priority and triage**

Residents have a small priority tag — elderly, child, injured, or able-bodied. Higher-priority residents give more score and have a shorter personal timer before their situation worsens. This is the triage lesson, and it should be readable at a glance from an icon above each resident's head.

**Rising water (the timer)**

- Instead of a bare countdown, use a **rising water level** as the clock: the visible waterline creeps up over the mission's duration, progressively submerging low roofs. A resident whose roof submerges is lost.
- Show it as a vertical gauge on the HUD with a marker for "critical." Escalate audio and rain intensity as it approaches critical.
- Mission ends when the water hits maximum, when all residents are rescued or lost, or when the player calls it in from the evacuation center.
- Mission length target: **2–4 minutes.** Tune the rise rate to hit that.

**Search missions (Mission 2 and partly 3)**

- Residents are not all visible on screen. Reduced ambient light plus a **visibility cone** from the boat; the packed flashlight widens and lengthens the cone substantially.
- A **radio ping** (if packed) draws a directional arrow at the screen edge toward the nearest unfound resident, on a cooldown.
- Faint audio cues — a call for help — get louder with proximity, so a player without the radio can still succeed by listening. Never make an unpacked item a hard fail, only a much harder run.

**Weather layer**

Rain particle overlay, screen darkening on the dusk/night missions, occasional lightning flash that briefly reveals the whole map, and wind that slightly biases boat drift. Tie intensity to the rising-water level so the mission visibly gets worse as it goes. Respect the "Reduce motion" setting.

**After-Action Report**

On mission end, show: residents rescued vs. lost, a breakdown by priority tag, time taken, supplies used vs. wasted, and one or two plain-language lines linking outcome to preparation. Score with a 1–3 star rating, then offer **Ulitin / Retry**, **Susunod / Next Mission**, and **Menu**. Retry must return the player straight to the Preparation Phase — re-packing after a failure is the whole point.

## 9. Suggested File Structure

```
project/ (Bayanihan Disaster Rescue)
  gameplay-overview.png        — gameplay reference screenshot (exact filename may vary)
  index.html                   — landing page + all screens (SPA-style screen switching)
  /css/
    styles.css                 — palette vars, typography, buttons, floaters
    screens.css                — per-screen layout
  /js/
    main.js                    — screen router, boot, audio context init
    landing.js                 — title screen button/floater wiring
    mission-select.js
    preparation.js             — supply grid, capacity, loadout state
    game.js                    — main loop, boat physics, rising water, weather
    rescue.js                  — resident spawning, triage tags, pickup/dropoff rules
    supplies.js                — supply definitions + field effects
    hud.js                     — capacity slots, water gauge, supply hotbar
    report.js                  — after-action scoring + prep linkage
    assets.js                  — asset loader + procedural fallback drawing
  /BAYANIHAN_ELEMENTS/
    REFERENCE (SCREENSHOT).png — title screen design reference (not shipped as a game asset)
    *.png                      — sprites (source of truth, referenced above)
  /assets/
    /maps/                     — tile layouts per mission (JSON)
    /audio/
```

Keep every module under ~400 lines. If `game.js` outgrows that, split the physics and the tide/water simulation out rather than letting one file swell.

## 10. Acceptance Checklist (self-verify before calling this done)

- [ ] Title screen visually matches the reference — palette, pixel display font, three stacked amber buttons, coastal scene composition
- [ ] Every visible button opens something real, including EXIT (confirmation → farewell card → return), with no dead buttons and no `window.close()`
- [ ] Mission Select shows three missions with distinct briefs and gated progression
- [ ] Preparation Phase enforces a visible capacity limit and lets the player pack a bad loadout on purpose
- [ ] Boat handles with momentum and drag, sprints from stamina, and reacts to current vectors
- [ ] Residents can be rescued from roofs, from open water (needs Salbabida), from behind debris (needs Lubid), and injured (needs Botika)
- [ ] Boat capacity of 3 forces at least two ferry trips to the evacuation center per mission
- [ ] Rising water submerges low roofs over time and can cause a resident to be lost
- [ ] A mission played reasonably well finishes in 2–4 minutes
- [ ] Mission 2 is meaningfully harder without the flashlight and meaningfully easier with the radio
- [ ] Rain, darkening, and lightning render, and all of it dampens under "Reduce motion"
- [ ] After-Action Report scores the run and names at least one explicit consequence of the preparation choices
- [ ] Retry returns to the Preparation Phase, not straight into the mission
- [ ] Touch controls appear on touch devices and the game is playable on a phone in landscape
- [ ] Runs by opening `index.html` directly in a browser — no build step, no server, no `localStorage`

## 11. Build Order (work in this sequence, verify each step runs before moving on)

1. Inspect all reference assets (§2) and write down the extracted palette, font, and asset inventory before touching code.
2. Static title screen matching the reference, with all buttons and floaters wired — this alone should be demo-able.
3. Screen router + Mission Select + Preparation Phase with working loadout state.
4. Canvas arena: tile map, boat movement, camera, collision. No residents yet.
5. Residents, pickup rules, capacity, drop-off, score.
6. Rising water, mission end conditions, After-Action Report.
7. Supply field effects, visibility cone, radio ping.
8. Weather layer, audio, juice — screen shake on debris hits, celebration on drop-off, water splash particles.
9. Balance pass against the 2–4 minute target, then the full acceptance checklist.

Commit at each numbered step so any stage can be demoed independently during the defense.
