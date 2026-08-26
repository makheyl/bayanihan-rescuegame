/* =========================================================================
   TERRAQUA CLASH — game.js
   Match loop, physics, Tide-Shift, hazards, power-ups, local input, AI and
   rendering. Everything runs against a fixed 1248 × 702 world so the physics
   feel is identical whatever size the canvas is drawn at.

   The loop is deliberately split into readInput → simulate → render with all
   player state living in plain objects, so a networked layer could later
   replace readInput and reconcile `state.players` without touching the sim.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ;
  var U = TQ.util;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var WORLD = TQ.terrains.WORLD;

  var SEAT_COLORS = ['#FF6B5B', '#4CC8DA', '#95DA51', '#FFD886'];
  var SEAT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

  var KEYMAP = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], dash: ['Space'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], dash: ['Enter', 'NumpadEnter'] },
    { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], dash: ['KeyU'] },
    { up: ['Numpad8'], down: ['Numpad5'], left: ['Numpad4'], right: ['Numpad6'], dash: ['Numpad0'] }
  ];

  var ACCEL_SCALE = 1.9;
  var DASH_CD = 1.2;
  var DASH_ACTIVE = 0.2;
  var PU_INTERVAL = 4.5;
  var RISE_WINDOW = 30;      // seconds of permanent sea-level rise at the end
  var CACHE_STEPS = 160;     // waterline quantisation for the terrain cache

  var keys = Object.create(null);
  var state = null;
  var view = { w: 0, h: 0, scale: 1, dpr: 1, offX: 0, offY: 0 };
  var ctx = null, canvas = null;
  var cache = { canvas: null, ctx: null, key: '', landPath: null };
  var raf = 0, lastT = 0;

  /* ==================================================================== */
  /*  DRAG — how hard it is to move, per class and per biome.             */
  /*  A land animal wading is sluggish; a water animal glides.            */
  /* ==================================================================== */
  function dragFor(p, tile) {
    var g = p.d.grip;
    if (tile === 'water') {
      if (p.def.cls === 'WATER') return 6.5 + g * 0.5;
      if (p.def.cls === 'AMPHI') return 6.4 + g * 0.8;
      return 9.2 + g * 0.5;
    }
    if (p.def.cls === 'WATER') return 9.5 + g * 0.5;
    if (p.def.cls === 'AMPHI') return 6.0 + g * 1.0;
    return 5.4 + g * 1.3;
  }

  /* ==================================================================== */
  /*  SETUP                                                                */
  /* ==================================================================== */

  /* Spawn each animal on ground its own class can survive on.
     Searching only for the highest ground dropped water animals onto the
     driest tile on the map, which cost them the round before it started. */
  function findSpawn(arena, angle, def) {
    var cx = WORLD.w / 2, cy = WORLD.h / 2;
    var wantsWater = def.cls === 'WATER';
    var best = null, bestScore = -Infinity;

    for (var da = -0.6; da <= 0.6; da += 0.1) {
      for (var f = 0.16; f <= 0.44; f += 0.035) {
        var a = angle + da;
        var x = cx + Math.cos(a) * WORLD.w * f;
        var y = cy + Math.sin(a) * WORLD.h * f * 1.5;
        if (x < 70 || y < 70 || x > WORLD.w - 70 || y > WORLD.h - 70) continue;

        var h = TQ.terrains.heightAt(arena, x, y);
        if (h < arena.voidLevel + 0.04) continue;          // never in open ocean

        // distance from the ideal band for this class: water animals want to
        // start just below the waterline, everyone else just above it
        var target = wantsWater ? arena.seaLevel - 0.10 : arena.seaLevel + 0.12;
        var s = -Math.abs(h - target) - Math.abs(da) * 0.05;

        if (arena.pillars.some(function (p) { return U.dist(p.x, p.y, x, y) < p.r + 46; })) continue;
        if (s > bestScore) { bestScore = s; best = { x: x, y: y }; }
      }
    }
    return best || { x: cx, y: cy };
  }

  function makePlayer(seat, def, isBot, arena, angle) {
    var d = TQ.animals.derive(def);
    var spot = findSpawn(arena, angle, def);
    return {
      seat: seat, def: def, d: d, isBot: isBot,
      name: isBot ? def.name + ' (AI)' : SEAT_NAMES[seat],
      color: SEAT_COLORS[seat],
      x: spot.x, y: spot.y, vx: 0, vy: 0,
      r: d.radius, mass: d.mass,
      alive: true, falling: 0, outAt: 0, outCause: '',
      stamina: 100,
      effects: { surge: 0, slam: 0, kelp: 0, frost: 0 },
      dashCD: 0, dashT: 0, stun: 0,
      flip: false, lean: 0, squash: 1, moving: false,
      kos: 0, spawnGuard: 1.2,
      lastHitBy: null, lastHitT: 0,
      ai: { timer: 0, dirX: 0, dirY: 0, wantDash: false, mood: 'roam' },
      pad: null
    };
  }

  function init() {
    var m = TQ.match.reload();
    var humans = U.clamp(m.humans, 1, 4);
    var bots = U.clamp(m.bots, 0, 4 - humans);
    if (humans + bots < 2) bots = 1;              // never start a solo round
    var seats = humans + bots;

    var arena = TQ.terrains.buildArena(m.terrain);
    var mid = (arena.def.tide.min + arena.def.tide.max) / 2;

    state = {
      arena: arena,
      players: [],
      powerups: [],
      floaters: [],
      particles: [],
      weather: [],
      falls: [],
      humans: humans, bots: bots, seats: seats,
      elapsed: 0,
      duration: TQ.settings.get('roundLength'),
      timeLeft: TQ.settings.get('roundLength'),
      phase: 'countdown',
      countdown: 3.6,
      tidePhase: -Math.PI / 2,
      tideDir: 1,
      lastTideDir: 1,
      rise: 0,
      puTimer: 2.4,
      fallTimer: 3,
      shake: 0,
      erodeVersion: 0,
      risWarned: false,
      banner: { t: 0, title: '', sub: '', cls: '' },
      results: null
    };

    arena.seaLevel = mid;

    for (var i = 0; i < seats; i++) {
      var def = TQ.animals.byId(m.picks[i]);
      var angle = (i / seats) * Math.PI * 2 + Math.PI * 0.25;
      state.players.push(makePlayer(i, def, i >= humans, arena, angle));
    }

    buildWeather();
    buildHud();
    layout();
    showBanner('GET READY', arena.def.name, '');
    setOverlay('ovCountdown', true);
    setOverlay('ovPause', false);
    setOverlay('ovResults', false);
  }

  function buildWeather() {
    var kind = state.arena.def.weather;
    var n = TQ.settings.get('particles') ? (kind === 'rain' ? 170 : kind === 'snow' ? 120 : 60) : 0;
    state.weather = [];
    for (var i = 0; i < n; i++) {
      state.weather.push({
        x: Math.random() * WORLD.w,
        y: Math.random() * WORLD.h,
        s: 0.5 + Math.random() * 0.9,
        v: 0.6 + Math.random() * 0.8,
        p: Math.random() * 6.28
      });
    }
  }

  /* ==================================================================== */
  /*  INPUT                                                                */
  /* ==================================================================== */

  function pressed(list) {
    for (var i = 0; i < list.length; i++) if (keys[list[i]]) return true;
    return false;
  }

  function readInput(p) {
    if (p.isBot) return { x: p.ai.dirX, y: p.ai.dirY, dash: p.ai.wantDash };

    var map = KEYMAP[p.seat];
    var x = 0, y = 0, dash = false;
    if (pressed(map.left)) x -= 1;
    if (pressed(map.right)) x += 1;
    if (pressed(map.up)) y -= 1;
    if (pressed(map.down)) y += 1;
    dash = pressed(map.dash);

    // a connected gamepad takes over this seat
    var pads = global.navigator.getGamepads ? global.navigator.getGamepads() : [];
    var pad = pads && pads[p.seat];
    if (pad && pad.connected) {
      var ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.abs(ax) > 0.22 || Math.abs(ay) > 0.22) { x = ax; y = ay; }
      if (pad.buttons[0] && pad.buttons[0].pressed) dash = true;
      // d-pad
      if (pad.buttons[12] && pad.buttons[12].pressed) y = -1;
      if (pad.buttons[13] && pad.buttons[13].pressed) y = 1;
      if (pad.buttons[14] && pad.buttons[14].pressed) x = -1;
      if (pad.buttons[15] && pad.buttons[15].pressed) x = 1;
    }

    var len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y, dash: dash };
  }

  /* ==================================================================== */
  /*  AI                                                                   */
  /* ==================================================================== */

  function sampleScore(p, x, y) {
    var arena = state.arena;
    if (x < 40 || y < 40 || x > WORLD.w - 40 || y > WORLD.h - 40) return -100;
    var tile = TQ.terrains.tileAt(arena, x, y);
    if (tile === 'void') return -100;

    var h = TQ.terrains.heightAt(arena, x, y);
    var friendly = (p.def.cls === 'AMPHI') ||
      (p.def.cls === 'LAND' && tile === 'land') ||
      (p.def.cls === 'WATER' && tile === 'water');

    var s = friendly ? 14 : -14;
    // ground that stays dry longest is worth more to land animals
    if (p.def.cls === 'LAND' || p.def.cls === 'AMPHI') s += (h - arena.seaLevel) * 26;
    // margin above the rising void floor matters to everybody
    s += U.clamp((h - arena.voidLevel) * 42, 0, 22);
    // pillars are solid
    for (var i = 0; i < arena.pillars.length; i++) {
      var pl = arena.pillars[i];
      if (U.dist2(pl.x, pl.y, x, y) < (pl.r + p.r + 8) * (pl.r + p.r + 8)) return -60;
    }
    return s;
  }

  function aiThink(p) {
    var arena = state.arena;
    var best = null, bestScore = -Infinity;
    var probe = p.r * 2.4 + Math.hypot(p.vx, p.vy) * 0.32;

    for (var a = 0; a < 12; a++) {
      var ang = (a / 12) * Math.PI * 2;
      var dx = Math.cos(ang), dy = Math.sin(ang);
      for (var m = 1; m <= 3; m++) {
        var dist = probe * m * 0.9 + 26;
        var s = sampleScore(p, p.x + dx * dist, p.y + dy * dist) / m;

        // low stamina overrides everything else
        if (p.stamina < 45) s *= 2.2;

        // pull toward a nearby power-up
        for (var q = 0; q < state.powerups.length; q++) {
          var pu = state.powerups[q];
          var pd = U.dist(pu.x, pu.y, p.x + dx * dist, p.y + dy * dist);
          if (pd < 190) s += (190 - pd) * 0.10;
        }

        // hunt: prefer rivals who are already near an edge
        if (p.stamina > 55) {
          for (var t = 0; t < state.players.length; t++) {
            var o = state.players[t];
            if (o === p || !o.alive) continue;
            var od = U.dist(o.x, o.y, p.x + dx * dist, p.y + dy * dist);
            if (od > 320) continue;
            var oExposed = 1;
            if (TQ.terrains.heightAt(arena, o.x, o.y) < arena.voidLevel + 0.1) oExposed = 2.6;
            var lighter = p.d.push >= o.d.push ? 1.4 : 0.7;
            s += (320 - od) * 0.05 * oExposed * lighter;
          }
        }

        if (s > bestScore) { bestScore = s; best = { x: dx, y: dy, d: dist }; }
      }
    }

    if (best) {
      p.ai.dirX = best.x; p.ai.dirY = best.y;
    } else {
      p.ai.dirX = 0; p.ai.dirY = 0;
    }

    // dash when a rival is lined up just ahead and pushing them helps
    p.ai.wantDash = false;
    if (p.dashCD <= 0 && p.stamina > 35) {
      for (var k = 0; k < state.players.length; k++) {
        var r2 = state.players[k];
        if (r2 === p || !r2.alive) continue;
        var vx = r2.x - p.x, vy = r2.y - p.y;
        var d2 = Math.hypot(vx, vy);
        if (d2 > 150 || d2 < 1) continue;
        if ((vx / d2) * p.ai.dirX + (vy / d2) * p.ai.dirY > 0.72) { p.ai.wantDash = true; break; }
      }
    }
  }

  /* ==================================================================== */
  /*  SIMULATION                                                           */
  /* ==================================================================== */

  function eliminate(p, cause) {
    if (!p.alive) return;
    p.alive = false;
    p.outAt = state.elapsed;
    p.outCause = cause;
    p.vx = p.vy = 0;

    // whoever shoved them last gets the credit — including for a shove that
    // stranded them in a hostile biome rather than knocking them off outright
    var killer = (p.lastHitT > 0 && p.lastHitBy && p.lastHitBy.alive) ? p.lastHitBy : null;
    if (killer) killer.kos++;

    burst(p.x, p.y, cause === 'fell' ? '#BFF0FF' : '#FFD3C2', 22);
    state.floaters.push({
      x: p.x, y: p.y - 30,
      text: cause === 'fell' ? 'SWEPT AWAY!' : 'EXHAUSTED!',
      c: '#FFFFFF', life: 1.6, t: 0
    });
    TQ.sfx.play(cause === 'fell' ? 'splash' : 'eliminate');
    shake(9);
    updateHud();
  }

  function burst(x, y, color, n) {
    if (!TQ.settings.get('particles')) n = Math.min(n, 6);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 180;
      state.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.6, t: 0, c: color, r: 2 + Math.random() * 4
      });
    }
  }

  function shake(v) {
    if (TQ.settings.get('screenShake')) state.shake = Math.min(22, state.shake + v);
  }

  function showBanner(title, sub, cls) {
    state.banner = { t: 2.2, title: title, sub: sub, cls: cls };
    var el = $('#banner');
    $('#bannerTitle').textContent = title;
    $('#bannerSub').textContent = sub || '';
    el.className = 'banner is-on' + (cls ? ' banner--' + cls : '');
  }

  /* ---------------------------------------------------------- tide ---- */
  function updateTide(dt) {
    var arena = state.arena, def = arena.def;
    var period = def.tide.period / Math.max(0.2, TQ.settings.get('tideSpeed'));
    state.tidePhase += (dt / period) * Math.PI * 2;

    var mid = (def.tide.min + def.tide.max) / 2;
    var amp = (def.tide.max - def.tide.min) / 2;

    // permanent rise over the closing seconds — the shrinking safe zone
    if (state.timeLeft < RISE_WINDOW) {
      state.rise = U.clamp((RISE_WINDOW - state.timeLeft) / RISE_WINDOW, 0, 1);
    }

    // heights are percentile ranks, so scale the permanent rise by how much
    // of the map is island — otherwise it erodes far more on some maps
    arena.seaLevel = mid + Math.sin(state.tidePhase) * amp + state.rise * def.span * 0.25;
    arena.voidLevel = def.voidLevel + state.rise * def.span * 0.72;

    var dir = Math.cos(state.tidePhase) >= 0 ? 1 : -1;
    state.tideDir = dir;
    if (dir !== state.lastTideDir && state.phase === 'playing') {
      state.lastTideDir = dir;
      if (dir > 0) showBanner('TIDE RISING', 'Low ground is about to flood', 'rise');
      else showBanner('TIDE RECEDING', 'The shoreline is pulling back', 'fall');
      TQ.sfx.play('tide');
    }
  }

  /* ------------------------------------------------------- one player -- */
  function updatePlayer(p, dt) {
    var arena = state.arena;

    // timers
    ['surge', 'slam', 'kelp', 'frost'].forEach(function (k) {
      if (p.effects[k] > 0) p.effects[k] = Math.max(0, p.effects[k] - dt);
    });
    if (p.dashCD > 0) p.dashCD -= dt;
    if (p.dashT > 0) p.dashT -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.lastHitT > 0) p.lastHitT -= dt;
    if (p.spawnGuard > 0) p.spawnGuard -= dt;

    var tile = TQ.terrains.tileAt(arena, p.x, p.y);

    /* --- falling into open ocean --- */
    if (tile === 'void') {
      var grace = p.def.cls === 'WATER' ? 1.1 : 0.45;
      p.falling += dt;
      if (p.falling === dt) {
        TQ.sfx.play('splash');
        burst(p.x, p.y, '#BFF0FF', 10);
      }
      if (p.falling > grace) { eliminate(p, 'fell'); return; }
    } else if (p.falling > 0) {
      p.falling = Math.max(0, p.falling - dt * 2.4);
    }

    /* --- input --- */
    var inp = (p.stun > 0 || p.effects.frost > 0) ? { x: 0, y: 0, dash: false } : readInput(p);
    var biome = TQ.animals.biome(p.def, tile === 'void' ? 'water' : tile);

    var accel = p.d.accel * ACCEL_SCALE * biome.spd * (p.effects.surge > 0 ? 1.55 : 1);
    var drag = dragFor(p, tile === 'void' ? 'water' : tile);
    if (arena.def.weather === 'rain') drag *= 0.85;     // wet ground = less traction
    if (p.falling > 0) { accel *= 0.35; drag *= 1.6; }

    p.vx += inp.x * accel * dt;
    p.vy += inp.y * accel * dt;

    /* --- dash --- */
    if (inp.dash && p.dashCD <= 0 && p.stun <= 0 && p.effects.frost <= 0) {
      var dx = inp.x, dy = inp.y;
      if (!dx && !dy) { dx = p.flip ? -1 : 1; dy = 0; }
      var dl = Math.hypot(dx, dy) || 1;
      var power = p.d.dashPower * biome.spd;
      p.vx += (dx / dl) * power;
      p.vy += (dy / dl) * power;
      p.dashCD = DASH_CD;
      p.dashT = DASH_ACTIVE;
      TQ.sfx.play('dash');
      burst(p.x, p.y, tile === 'water' ? '#BFF0FF' : '#FFF0C4', 7);
    }

    /* --- rip currents (Coral Reef) --- */
    if (arena.def.hazard === 'current' && tile === 'water') {
      var cell = arena.cell;
      var hL = TQ.terrains.heightAt(arena, p.x - cell, p.y);
      var hR = TQ.terrains.heightAt(arena, p.x + cell, p.y);
      var hU = TQ.terrains.heightAt(arena, p.x, p.y - cell);
      var hD = TQ.terrains.heightAt(arena, p.x, p.y + cell);
      // flow downhill — i.e. out toward deep water
      p.vx += (hL - hR) * 620 * dt;
      p.vy += (hU - hD) * 620 * dt;
    }

    /* --- integrate --- */
    var k = Math.exp(-drag * dt);
    p.vx *= k; p.vy *= k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    /* --- pillars are solid --- */
    arena.pillars.forEach(function (pl) {
      var dx2 = p.x - pl.x, dy2 = p.y - pl.y;
      var d = Math.hypot(dx2, dy2), min = pl.r + p.r;
      if (d < min && d > 0.01) {
        var nx = dx2 / d, ny = dy2 / d;
        p.x = pl.x + nx * min;
        p.y = pl.y + ny * min;
        var vn = p.vx * nx + p.vy * ny;
        if (vn < 0) { p.vx -= vn * nx * 1.5; p.vy -= vn * ny * 1.5; }
      }
    });

    /* --- world bounds: past the border there is only ocean --- */
    if (p.x < -30 || p.y < -30 || p.x > WORLD.w + 30 || p.y > WORLD.h + 30) {
      p.x = U.clamp(p.x, -30, WORLD.w + 30);
      p.y = U.clamp(p.y, -30, WORLD.h + 30);
      eliminate(p, 'fell');
      return;
    }

    /* --- stamina --- */
    if (p.effects.kelp > 0) {
      p.stamina = Math.min(100, p.stamina + 12 * dt);
    } else {
      p.stamina = U.clamp(p.stamina + biome.sta * dt, 0, 100);
      if (p.stamina <= 0) { eliminate(p, 'exhausted'); return; }
    }

    /* --- crumbling floes (Arctic): the ice you stand on never comes back --- */
    if (arena.def.hazard === 'crumble' && tile === 'land') {
      var gx = Math.floor(p.x / arena.cell), gy = Math.floor(p.y / arena.cell);
      var idx = gy * arena.W + gx;
      if (idx >= 0 && idx < arena.height.length) {
        var before = arena.height[idx];
        var after = Math.max(0, before - 0.075 * dt);
        arena.height[idx] = after;
        // only invalidate the terrain cache when the tile could actually
        // change how it renders, not on every frame of erosion
        if (Math.round(before * CACHE_STEPS) !== Math.round(after * CACHE_STEPS)) state.erodeVersion++;
        if (Math.random() < dt * 5) burst(p.x, p.y + p.r * 0.6, '#FFFFFF', 1);
      }
    }

    /* --- power-up pickup --- */
    for (var i = state.powerups.length - 1; i >= 0; i--) {
      var pu = state.powerups[i];
      if (U.dist2(pu.x, pu.y, p.x, p.y) < (p.r + 22) * (p.r + 22)) {
        var label = TQ.powerups.apply(pu, p, state);
        state.floaters.push({ x: p.x, y: p.y - 42, text: label, c: pu.type.c1, life: 1.1, t: 0 });
        burst(pu.x, pu.y, pu.type.c1, 14);
        state.powerups.splice(i, 1);
      }
    }

    /* --- visual state --- */
    var sp = Math.hypot(p.vx, p.vy);
    p.moving = sp > 26;
    if (Math.abs(p.vx) > 22) p.flip = p.vx < 0;
    p.lean = U.damp(p.lean, U.clamp(p.vx / 620, -0.3, 0.3), 9, dt);
    p.squash = U.damp(p.squash, 1, 8, dt);

    if (tile === 'water' && p.moving && Math.random() < dt * 12 && TQ.settings.get('particles')) {
      state.particles.push({
        x: p.x + U.rand(-p.r, p.r), y: p.y + p.r * 0.6,
        vx: -p.vx * 0.12, vy: -30 - Math.random() * 40,
        life: 0.4, t: 0, c: '#DFFAFF', r: 2 + Math.random() * 3
      });
    }
  }

  /* ---------------------------------------------------- collisions ---- */
  function resolveCollisions() {
    var ps = state.players;
    for (var i = 0; i < ps.length; i++) {
      var a = ps[i];
      if (!a.alive) continue;
      for (var j = i + 1; j < ps.length; j++) {
        var b = ps[j];
        if (!b.alive) continue;

        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.hypot(dx, dy);
        var reachA = a.effects.slam > 0 ? 8 : 0;
        var reachB = b.effects.slam > 0 ? 8 : 0;
        var min = a.r + b.r + reachA + reachB;
        if (d >= min || d < 0.001) continue;

        var nx = dx / d, ny = dy / d;
        var overlap = min - d;
        var tot = a.mass + b.mass;

        a.x -= nx * overlap * (b.mass / tot);
        a.y -= ny * overlap * (b.mass / tot);
        b.x += nx * overlap * (a.mass / tot);
        b.y += ny * overlap * (a.mass / tot);

        var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        var vn = rvx * nx + rvy * ny;
        if (vn > 0) continue;                     // already separating

        var e = 1.3;
        var jImp = -(1 + e) * vn / (1 / a.mass + 1 / b.mass);
        jImp = Math.max(jImp, 26);                // always at least a nudge

        var aPow = a.d.push * (a.effects.slam > 0 ? 2.6 : 1) * (a.dashT > 0 ? 1.7 : 1);
        var bPow = b.d.push * (b.effects.slam > 0 ? 2.6 : 1) * (b.dashT > 0 ? 1.7 : 1);

        // a shield, or the brief guard just after spawning, absorbs the shove
        // (without spawn protection the opening scrum can ring someone out
        //  before they have taken a single input)
        var bProtected = b.effects.kelp > 0 || b.spawnGuard > 0;
        var aProtected = a.effects.kelp > 0 || a.spawnGuard > 0;

        if (!bProtected) {
          b.vx += (jImp * aPow / b.mass) * nx;
          b.vy += (jImp * aPow / b.mass) * ny;
          b.squash = 0.82;
          if (aPow > 0.9) { b.lastHitBy = a; b.lastHitT = 4.5; }
        }
        if (!aProtected) {
          a.vx -= (jImp * bPow / a.mass) * nx;
          a.vy -= (jImp * bPow / a.mass) * ny;
          a.squash = 0.82;
          if (bPow > 0.9) { a.lastHitBy = b; a.lastHitT = 4.5; }
        }

        var force = jImp * Math.max(aPow, bPow);
        if (force > 120) {
          TQ.sfx.play('hit');
          shake(U.clamp(force / 90, 2, 12));
          burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#FFF3C4', force > 500 ? 14 : 7);
          if (force > 620) {
            state.floaters.push({
              x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 34,
              text: 'BOOM!', c: '#FFD886', life: 0.8, t: 0
            });
          }
        }
      }
    }
  }

  /* ------------------------------------------------------- hazards ---- */
  function updateHazards(dt) {
    var arena = state.arena;

    if (arena.def.hazard === 'geyser') {
      arena.geysers.forEach(function (g) {
        g.phase += dt;
        var cyc = g.phase % g.period;
        var wasErupting = g.state;
        g.state = cyc > g.period - 0.6 ? 2 : (cyc > g.period - 1.6 ? 1 : 0);
        if (g.state === 2 && wasErupting !== 2) {
          TQ.sfx.play('splash');
          shake(6);
          burst(g.x, g.y, '#BFE9FF', 18);
          state.players.forEach(function (p) {
            if (!p.alive || p.effects.kelp > 0) return;
            var d = U.dist(g.x, g.y, p.x, p.y);
            if (d > g.r + p.r) return;
            var nx = (p.x - g.x) / (d || 1), ny = (p.y - g.y) / (d || 1);
            p.vx += nx * 430; p.vy += ny * 430;
            p.squash = 0.8;
          });
        }
      });
    }

    if (arena.def.hazard === 'falling') {
      state.fallTimer -= dt;
      if (state.fallTimer <= 0) {
        state.fallTimer = 2.8 + Math.random() * 2.4;
        var cx = WORLD.w / 2, cy = WORLD.h / 2;
        var ang = Math.random() * Math.PI * 2, rad = Math.random() * WORLD.h * 0.36;
        state.falls.push({
          x: cx + Math.cos(ang) * rad * 1.6, y: cy + Math.sin(ang) * rad,
          t: 0, warn: 1.2, r: 52, done: false
        });
      }
      for (var i = state.falls.length - 1; i >= 0; i--) {
        var f = state.falls[i];
        f.t += dt;
        if (!f.done && f.t >= f.warn) {
          f.done = true;
          TQ.sfx.play('hit');
          shake(10);
          burst(f.x, f.y, '#A37042', 20);
          state.players.forEach(function (p) {
            if (!p.alive || p.effects.kelp > 0) return;
            var d = U.dist(f.x, f.y, p.x, p.y);
            if (d > f.r + p.r) return;
            var nx = (p.x - f.x) / (d || 1), ny = (p.y - f.y) / (d || 1);
            p.vx += nx * 520; p.vy += ny * 520;
            p.stun = 0.5;
            p.squash = 0.75;
          });
        }
        if (f.t > f.warn + 0.6) state.falls.splice(i, 1);
      }
    }
  }

  /* -------------------------------------------------------- main step -- */
  function step(dt) {
    if (state.phase === 'countdown') {
      state.countdown -= dt;
      var n = Math.ceil(state.countdown - 0.6);
      var el = $('#countdownNum');
      var label = n > 0 ? String(n) : 'GO!';
      if (el.textContent !== label) {
        el.textContent = label;
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        TQ.sfx.play(n > 0 ? 'countdown' : 'go');
      }
      $('#countdownSub').textContent = state.arena.def.name + ' · ' + state.arena.def.tagline;
      updateTide(dt * 0.3);
      if (state.countdown <= 0) {
        state.phase = 'playing';
        setOverlay('ovCountdown', false);
        showBanner('SURVIVE!', 'Shove them into the deep water', '');
      }
      return;
    }

    if (state.phase !== 'playing') return;

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.duration - state.elapsed);

    updateTide(dt);

    // AI thinks a few times a second, not every frame
    state.players.forEach(function (p) {
      if (!p.isBot || !p.alive) return;
      p.ai.timer -= dt;
      if (p.ai.timer <= 0) { p.ai.timer = 0.14; aiThink(p); }
    });

    state.players.forEach(function (p) { if (p.alive) updatePlayer(p, dt); });
    resolveCollisions();
    updateHazards(dt);

    // power-ups
    state.puTimer -= dt;
    if (state.puTimer <= 0) {
      state.puTimer = PU_INTERVAL;
      TQ.powerups.spawn(state);
    }
    for (var i = state.powerups.length - 1; i >= 0; i--) {
      var pu = state.powerups[i];
      pu.pop = Math.max(0, pu.pop - dt * 3);
      if (state.elapsed - pu.born > pu.life) state.powerups.splice(i, 1);
    }

    // floaters + particles
    for (var f = state.floaters.length - 1; f >= 0; f--) {
      var fl = state.floaters[f];
      fl.t += dt; fl.y -= 34 * dt;
      if (fl.t >= fl.life) state.floaters.splice(f, 1);
    }
    for (var q = state.particles.length - 1; q >= 0; q--) {
      var pt = state.particles[q];
      pt.t += dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += 320 * dt; pt.vx *= 0.97;
      if (pt.t >= pt.life) state.particles.splice(q, 1);
    }

    if (state.banner.t > 0) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) $('#banner').classList.remove('is-on');
    }
    state.shake = Math.max(0, state.shake - dt * 40);

    // one-time warning when the permanent rise kicks in
    if (state.timeLeft <= RISE_WINDOW && !state.risWarned) {
      state.risWarned = true;
      showBanner('SEA LEVELS RISING', 'The island will not come back', 'danger');
      TQ.sfx.play('tide');
    }

    // win conditions
    var alive = state.players.filter(function (p) { return p.alive; });
    if (alive.length <= 1 || state.timeLeft <= 0) finish(alive);
  }

  /* ==================================================================== */
  /*  RESULTS                                                              */
  /* ==================================================================== */

  function finish(alive) {
    state.phase = 'over';
    $('#banner').classList.remove('is-on');

    var ranked = state.players.slice().map(function (p) {
      var survived = p.alive ? state.elapsed : p.outAt;
      return { p: p, survived: survived, score: Math.round(survived + p.kos * 12) };
    }).sort(function (a, b) {
      if (a.p.alive !== b.p.alive) return a.p.alive ? -1 : 1;
      return b.score - a.score;
    });

    state.results = ranked;
    var winner = ranked[0];

    $('#resultTitle').textContent = (alive.length === 1)
      ? winner.p.def.name + ' survives!'
      : (alive.length === 0 ? 'Nobody made it' : 'Time — ' + winner.p.def.name + ' leads');

    var list = $('#resultList');
    list.innerHTML = '';
    ranked.forEach(function (row, i) {
      var li = document.createElement('li');
      var cause = row.p.alive ? 'Survived the round'
        : (row.p.outCause === 'fell' ? 'Swept into deep water' : 'Ran out of stamina');
      li.innerHTML =
        '<span class="results__rank">' + (i + 1) + '</span>' +
        '<canvas class="results__av"></canvas>' +
        '<span class="results__who">' +
          '<span class="results__name">' + U.esc(row.p.def.name) + '</span>' +
          '<span class="results__detail">' + U.esc(row.p.name) + ' · ' + cause +
            ' · ' + U.fmtTime(row.survived) + ' · ' + row.p.kos + ' KO' + (row.p.kos === 1 ? '' : 's') +
          '</span>' +
        '</span>' +
        '<span class="results__score">' + row.score + '</span>';
      list.appendChild(li);
      var cv = li.querySelector('canvas');
      cv.style.boxShadow = '0 0 0 3px ' + row.p.color;
      requestAnimationFrame(function () {
        TQ.animals.drawToCanvas(cv, row.p.def, { ground: false, t: i });
      });
    });

    // conservation note for the winning species + the habitat
    var isWater = winner.p.def.sdg.indexOf(14) !== -1;
    $('#resultFact').innerHTML =
      '<div class="fact-card' + (isWater ? '' : ' fact-card--land') + '">' +
        '<div class="fact-card__head">' + U.esc(winner.p.def.species) + '</div>' +
        U.esc(winner.p.def.fact) +
      '</div>' +
      '<div class="fact-card fact-card--land">' +
        '<div class="fact-card__head">' + U.esc(state.arena.def.name) + '</div>' +
        U.esc(state.arena.def.fact) +
      '</div>';

    TQ.sfx.play('win');
    setOverlay('ovResults', true);
    updateHud();
  }

  /* ==================================================================== */
  /*  RENDER                                                               */
  /* ==================================================================== */

  function layout() {
    var stage = $('#stage');
    var rect = stage.getBoundingClientRect();
    view.dpr = Math.min(global.devicePixelRatio || 1, 2);
    view.w = Math.max(1, Math.round(rect.width));
    view.h = Math.max(1, Math.round(rect.height));
    // fit the fixed world into whatever box CSS gave us and centre it, so a
    // rounding difference in the stage's aspect ratio can never skew the sim
    view.scale = Math.min(view.w / WORLD.w, view.h / WORLD.h);
    view.offX = (view.w - WORLD.w * view.scale) / 2;
    view.offY = (view.h - WORLD.h * view.scale) / 2;

    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    ctx = canvas.getContext('2d');

    if (!cache.canvas) cache.canvas = document.createElement('canvas');
    cache.canvas.width = canvas.width;
    cache.canvas.height = canvas.height;
    cache.ctx = cache.canvas.getContext('2d');
    cache.key = '';
  }

  function worldTransform(c) {
    var k = view.dpr * view.scale;
    c.setTransform(k, 0, 0, k, view.offX * view.dpr, view.offY * view.dpr);
  }

  /* The terrain is expensive to build but only changes when the waterline
     moves a whole tile, so it is cached and re-rendered on demand. */
  function ensureTerrainCache() {
    var a = state.arena;
    var key = Math.round(a.seaLevel * CACHE_STEPS) + '|' + Math.round(a.voidLevel * CACHE_STEPS) +
      '|' + state.erodeVersion + '|' + view.w + 'x' + view.h;
    if (key === cache.key) return;
    cache.key = key;
    var c = cache.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
    worldTransform(c);
    var paths = TQ.terrains.paintTerrain(c, a, { scale: 1, t: state.elapsed, detail: true });
    cache.landPath = paths.land;
  }

  function drawPlayer(p, t) {
    var arena = state.arena;
    var tile = TQ.terrains.tileAt(arena, p.x, p.y);
    var sinking = p.falling > 0;
    var scale = sinking ? U.clamp(1 - p.falling * 0.55, 0.35, 1) : 1;
    var alpha = sinking ? U.clamp(1 - p.falling * 0.5, 0.25, 1) : 1;

    // stamina ring under the feet
    var lowStam = p.stamina < 100;
    if (lowStam) {
      ctx.save();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = 'rgba(20,49,63,.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r * 0.95, p.r * 0.95, p.r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = p.stamina < 30 ? '#DE575D' : (p.stamina < 60 ? '#F0A93C' : '#3FBA54');
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r * 0.95, p.r * 0.95, p.r * 0.36,
        0, -Math.PI / 2, -Math.PI / 2 + (p.stamina / 100) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // seat colour ring
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r * 0.95, p.r * 0.72, p.r * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // kelp shield bubble
    if (p.effects.kelp > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(107,203,119,.22)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(63,186,84,.9)'; ctx.stroke();
      ctx.restore();
    }
    // dash streak
    if (p.dashT > 0) {
      ctx.save();
      ctx.globalAlpha = p.dashT / DASH_ACTIVE * 0.5;
      ctx.strokeStyle = '#FFF3C4'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
    // frozen block
    if (p.effects.frost > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#CFF3FF';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(p.x - p.r * 1.2, p.y - p.r * 1.5, p.r * 2.4, p.r * 2.7, 8)
                    : ctx.rect(p.x - p.r * 1.2, p.y - p.r * 1.5, p.r * 2.4, p.r * 2.7);
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#7FD4F0'; ctx.stroke();
      ctx.restore();
    }

    TQ.animals.draw(ctx, p.def, p.x, p.y, p.r * scale, {
      t: t, flip: p.flip, lean: p.lean, squash: p.squash,
      moving: p.moving, alpha: alpha
    });

    // wading splash ring
    if (tile === 'water' && !sinking) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#EAFBFF'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r * 0.7, p.r * (0.9 + Math.sin(t * 6 + p.seat) * 0.07), p.r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // effect badges
    var bx = p.x - 14, by = p.y - p.r * 1.75;
    ['surge', 'slam', 'kelp'].forEach(function (k) {
      if (p.effects[k] <= 0) return;
      var ty = TQ.powerups.byId(k);
      TQ.powerups.drawEffectBadge(ctx, k, bx, by, p.effects[k], ty.duration);
      bx += 26;
    });

    // name tag
    if (TQ.settings.get('showNames')) {
      ctx.save();
      ctx.font = '700 15px "Nunito", sans-serif';
      ctx.textAlign = 'center';
      var label = p.isBot ? p.def.name + ' · AI' : 'P' + (p.seat + 1);
      var w = ctx.measureText(label).width + 14;
      var ty2 = p.y - p.r * 2.15;
      ctx.fillStyle = 'rgba(20,49,63,.78)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(p.x - w / 2, ty2 - 13, w, 20, 10)
                    : ctx.rect(p.x - w / 2, ty2 - 13, w, 20);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - w / 2, ty2 + 5, w, 2.5);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, p.x, ty2 + 2);
      ctx.restore();
    }
  }

  function drawWeather(t) {
    var kind = state.arena.def.weather;
    if (!state.weather.length) return;
    ctx.save();
    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(210,240,255,.5)';
      ctx.lineWidth = 2;
      state.weather.forEach(function (d) {
        var y = (d.y + t * 720 * d.v) % (WORLD.h + 40) - 20;
        var x = (d.x + t * 90) % (WORLD.w + 40) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6 * d.s, y + 20 * d.s);
        ctx.stroke();
      });
    } else if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      state.weather.forEach(function (d) {
        var y = (d.y + t * 90 * d.v) % (WORLD.h + 20) - 10;
        var x = (d.x + Math.sin(t * 0.8 + d.p) * 34) % (WORLD.w + 20) - 10;
        ctx.beginPath();
        ctx.arc(x, y, 2.2 * d.s, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (kind === 'heat') {
      ctx.fillStyle = 'rgba(255,236,180,.5)';
      state.weather.forEach(function (d) {
        var y = (d.y - t * 60 * d.v) % (WORLD.h + 20);
        if (y < 0) y += WORLD.h + 20;
        var x = d.x + Math.sin(t * 1.6 + d.p) * 16;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 * d.s, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      state.weather.forEach(function (d) {
        var y = (d.y - t * 30 * d.v) % (WORLD.h + 20);
        if (y < 0) y += WORLD.h + 20;
        ctx.beginPath();
        ctx.arc(d.x + Math.sin(t + d.p) * 10, y, 1.4 * d.s, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  function render(t) {
    var arena = state.arena;
    ensureTerrainCache();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var sx = 0, sy = 0;
    if (state.shake > 0.2) {
      sx = U.rand(-state.shake, state.shake);
      sy = U.rand(-state.shake, state.shake);
    }

    // The cache was rendered through the same world transform, so blit it
    // 1:1 in device pixels (offset by the shake) rather than re-scaling it.
    var k = view.dpr * view.scale;
    ctx.setTransform(1, 0, 0, 1, sx * k, sy * k);
    ctx.drawImage(cache.canvas, 0, 0);

    worldTransform(ctx);
    ctx.translate(sx, sy);

    // (the shoreline foam is baked into the cache — it cannot be stroked
    //  live, because stroking the blob path outlines every circle in it)

    // Tide telegraph: tiles within a hair of the waterline shimmer, giving
    // ~2s of warning before they flip. Drawn as blobs to match the terrain.
    var about = state.tideDir > 0;
    ctx.save();
    ctx.globalAlpha = 0.26 + Math.sin(t * 8) * 0.14;
    ctx.fillStyle = about ? '#BFF0FF' : '#FFF0C4';
    ctx.beginPath();
    for (var gy = 0; gy < arena.H; gy++) {
      for (var gx = 0; gx < arena.W; gx++) {
        var diff = arena.height[gy * arena.W + gx] - arena.seaLevel;
        var warn = about ? (diff > 0 && diff < 0.028) : (diff < 0 && diff > -0.028);
        if (!warn) continue;
        var wx = (gx + 0.5) * arena.cell, wy = (gy + 0.5) * arena.cell;
        ctx.moveTo(wx + arena.cell * 0.8, wy);
        ctx.arc(wx, wy, arena.cell * 0.8, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();

    // geysers
    if (arena.def.hazard === 'geyser') {
      arena.geysers.forEach(function (g) {
        if (g.state === 0) return;
        ctx.save();
        if (g.state === 1) {
          ctx.globalAlpha = 0.4 + Math.sin(t * 14) * 0.25;
          ctx.strokeStyle = '#EAFBFF'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#DFF6FF';
          ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 1.15, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
    }

    // falling timber
    state.falls.forEach(function (f) {
      ctx.save();
      if (!f.done) {
        var k = f.t / f.warn;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#1B2A18';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.4 + k * 0.6), f.r * 0.4 * (0.4 + k * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#7A4A28';
        var dropY = f.y - (1 - k) * 340;
        ctx.beginPath(); ctx.ellipse(f.x, dropY, 15, 42, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#3D2713'; ctx.stroke();
      } else {
        ctx.globalAlpha = U.clamp(1 - (f.t - f.warn) / 0.6, 0, 1);
        ctx.fillStyle = '#7A4A28';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 46, 15, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#3D2713'; ctx.stroke();
      }
      ctx.restore();
    });

    // power-ups
    state.powerups.forEach(function (pu) { TQ.powerups.draw(ctx, pu, t); });

    // players, back to front
    state.players.slice()
      .filter(function (p) { return p.alive; })
      .sort(function (a, b) { return a.y - b.y; })
      .forEach(function (p) { drawPlayer(p, t); });

    // particles
    state.particles.forEach(function (pt) {
      ctx.save();
      ctx.globalAlpha = U.clamp(1 - pt.t / pt.life, 0, 1);
      ctx.fillStyle = pt.c;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // floating text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 22px "Baloo 2", "Nunito", sans-serif';
    state.floaters.forEach(function (fl) {
      ctx.globalAlpha = U.clamp(1 - fl.t / fl.life, 0, 1);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,49,63,.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillStyle = fl.c;
      ctx.fillText(fl.text, fl.x, fl.y);
    });
    ctx.restore();

    drawWeather(t);

    // colour grade — darker while the tide is rising, warmer as it falls
    var grade = state.arena.def.weather === 'rain' ? 0.2 : 0.08;
    grade += state.tideDir > 0 ? 0.1 : 0;
    grade += state.rise * 0.18;
    ctx.save();
    ctx.fillStyle = state.tideDir > 0
      ? 'rgba(20,60,90,' + grade.toFixed(3) + ')'
      : 'rgba(255,210,140,' + (grade * 0.55).toFixed(3) + ')';
    ctx.fillRect(-40, -40, WORLD.w + 80, WORLD.h + 80);
    ctx.restore();

    // vignette
    ctx.save();
    var vg = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.42,
                                      WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,20,35,.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(-40, -40, WORLD.w + 80, WORLD.h + 80);
    ctx.restore();
  }

  /* ==================================================================== */
  /*  HUD                                                                  */
  /* ==================================================================== */

  function buildHud() {
    var terr = state.arena.def;
    $('#hudTerrain').textContent = terr.name;
    $('#hudSdg').innerHTML = terr.sdg.map(function (n) {
      return '<span class="sdg-dot sdg-' + n + '">' + n + '</span>';
    }).join('');

    var strip = $('#pstrip');
    strip.innerHTML = '';
    state.players.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'pcard';
      el.id = 'pcard-' + p.seat;
      el.innerHTML =
        '<canvas class="pcard__avatar" style="box-shadow:0 0 0 3px ' + p.color + '"></canvas>' +
        '<div class="pcard__main">' +
          '<div class="pcard__row">' +
            '<span class="pcard__name">' + U.esc(p.def.name) + '</span>' +
            '<span class="pcard__tag" style="background:' + p.color + '">' +
              (p.isBot ? 'AI' : 'P' + (p.seat + 1)) + '</span>' +
            '<span class="pcard__kos" data-kos>0 KO</span>' +
          '</div>' +
          '<div class="stam"><div class="stam__fill" data-stam></div></div>' +
          '<div class="pcard__fx" data-fx></div>' +
        '</div>';
      strip.appendChild(el);
      requestAnimationFrame(function () {
        TQ.animals.drawToCanvas(el.querySelector('canvas'), p.def, { ground: false, t: p.seat });
      });
    });
  }

  function updateHud() {
    var timer = $('#hudTimer');
    timer.textContent = U.fmtTime(state.timeLeft);
    timer.classList.toggle('is-urgent', state.timeLeft <= 15 && state.phase === 'playing');

    var alive = state.players.filter(function (p) { return p.alive; }).length;
    $('#hudAlive').textContent = alive + (alive === 1 ? ' alive' : ' alive');

    // tide gauge
    var a = state.arena;
    var lo = a.def.tide.min - 0.06, hi = a.def.tide.max + 0.2;
    var pct = U.clamp(U.inv(a.seaLevel, lo, hi), 0, 1) * 100;
    $('#hudTideMarker').style.left = pct.toFixed(1) + '%';
    var arrow = $('#hudTideArrow');
    arrow.textContent = state.tideDir > 0 ? '▲' : '▼';
    arrow.style.transform = state.tideDir > 0 ? 'translateY(-2px)' : 'translateY(2px)';
    $('#hudTideLabel').textContent = state.rise > 0.02
      ? 'Rising ' + Math.round(state.rise * 100) + '%'
      : (state.tideDir > 0 ? 'Tide in' : 'Tide out');

    // best score so far, for the crown
    var leader = null, bestScore = -1;
    state.players.forEach(function (p) {
      var s = (p.alive ? state.elapsed : p.outAt) + p.kos * 12;
      if (p.alive && s > bestScore) { bestScore = s; leader = p; }
    });

    state.players.forEach(function (p) {
      var el = document.getElementById('pcard-' + p.seat);
      if (!el) return;
      el.classList.toggle('is-out', !p.alive);
      el.classList.toggle('is-leader', p === leader && state.players.length > 1);

      var stam = el.querySelector('[data-stam]');
      stam.style.width = (p.alive ? p.stamina : 0) + '%';
      stam.classList.toggle('is-low', p.stamina < 30);
      stam.classList.toggle('is-mid', p.stamina >= 30 && p.stamina < 60);

      el.querySelector('[data-kos]').textContent = p.kos + ' KO' + (p.kos === 1 ? '' : 's');

      var fx = el.querySelector('[data-fx]');
      var want = ['surge', 'slam', 'kelp', 'frost'].filter(function (k) { return p.effects[k] > 0; });
      var sig = want.join(',');
      if (fx.getAttribute('data-sig') !== sig) {
        fx.setAttribute('data-sig', sig);
        fx.innerHTML = want.map(function (k) {
          var ty = TQ.powerups.byId(k);
          return '<span class="fxdot" title="' + U.esc(ty.name) + '" style="background:' + ty.c2 + '"></span>';
        }).join('');
      }
    });
  }

  function setOverlay(id, on) {
    $('#' + id).classList.toggle('is-on', !!on);
  }

  /* ==================================================================== */
  /*  LOOP + CONTROLS                                                      */
  /* ==================================================================== */

  function frame(now) {
    raf = global.requestAnimationFrame(frame);
    if (!lastT) lastT = now;
    // clamp both ends: a long tab-out must not teleport the sim, and a clock
    // that jumps backwards must never run it in reverse
    var dt = U.clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;

    if (state.phase !== 'paused') step(dt);
    render(state.elapsed);
    updateHud();
  }

  function togglePause(force) {
    if (state.phase === 'over' || state.phase === 'countdown') return;
    var want = force != null ? force : (state.phase !== 'paused');
    if (want) {
      state.phase = 'paused';
      setOverlay('ovPause', true);
      TQ.sfx.play('back');
    } else {
      state.phase = 'playing';
      setOverlay('ovPause', false);
      lastT = 0;
      dropFocus();
      TQ.sfx.play('click');
    }
  }

  /* Player 2 dashes with Enter, which would otherwise re-trigger whichever
     overlay button still holds focus. */
  function dropFocus() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function restart() {
    global.cancelAnimationFrame(raf);
    lastT = 0;
    dropFocus();
    init();
    raf = global.requestAnimationFrame(frame);
  }

  /* ==================================================================== */
  /*  BOOT                                                                 */
  /* ==================================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    TQ.boot();
    canvas = $('#arena');

    global.addEventListener('keydown', function (ev) {
      // stop arrows/space scrolling the page mid-match
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(ev.code) !== -1) ev.preventDefault();
      keys[ev.code] = true;

      if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
      if (ev.code === 'KeyR') restart();
      if (ev.code === 'KeyM') {
        TQ.settings.set('muted', !TQ.settings.get('muted'));
        TQ.sfx.applyVolume();
        TQ.toast(TQ.settings.get('muted') ? 'Muted' : 'Sound on');
      }
    });
    global.addEventListener('keyup', function (ev) { keys[ev.code] = false; });
    global.addEventListener('blur', function () {
      keys = Object.create(null);
      if (state && state.phase === 'playing') togglePause(true);
    });

    $('#btnPause').addEventListener('click', function () { togglePause(); });
    $('#pauseResume').addEventListener('click', function () { togglePause(false); });
    $('#pauseRestart').addEventListener('click', restart);
    $('#pauseQuit').addEventListener('click', function () { TQ.nav.back('index.html'); });
    $('#resAgain').addEventListener('click', restart);
    $('#resTerrain').addEventListener('click', function () { TQ.nav.go('terrain-select.html'); });
    $('#resMenu').addEventListener('click', function () { TQ.nav.back('index.html'); });

    var rt = 0;
    global.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 150);
    });

    init();
    raf = global.requestAnimationFrame(frame);
  });

}(window));
