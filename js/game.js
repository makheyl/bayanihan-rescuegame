/* =====================================================================
   game.js — mission lifecycle, fixed-timestep loop, boat physics,
   the rising water, weather and the rescue interaction.
   Drawing lives in render.js.
   ===================================================================== */
(function (BR) {
  'use strict';

  var T = BR.maps.T, TILE = BR.maps.TILE;

  var STEP = 1 / 60;            // fixed physics step
  var MAX_FRAME = 0.25;         // never simulate more than this in one frame

  var CAPACITY = 3;             // residents the bangka can carry
  var CRITICAL = 0.70;          // water level at which everything escalates
  var REACH = 72;               // rescue reach in px — must comfortably exceed
                                // the closest the hull can get to a roof edge
                                // (one tile away, 48px, less the edge offset)
  var BOAT_R = 17;

  var ACCEL = 640, DRAG = 1.95, MAX_SPD = 178, SPRINT_MUL = 1.52, TURN = 6.4;
  var STAM_DRAIN = 26, STAM_REGEN = 10.5;

  var g = {
    active: false, paused: false, ended: false,
    mission: null, map: null, roster: [], aboard: [],
    inventory: null, missionState: null,
    boat: null, cam: null,
    CAPACITY: CAPACITY, CRITICAL: CRITICAL,
    parts: [], rain: [], ping: null,
    weather: { flash: 0, nextFlash: 8, windX: 0, windY: 0, windT: 0, rain: 0 },
    shake: 0, time: 0, holdT: 0, holdTarget: null, dockHold: 0,
    dropCd: 0, canvas: null, ctx: null, vw: 0, vh: 0, dpr: 1
  };

  /* ------------------------------------------------------------------
     INPUT
     ------------------------------------------------------------------ */
  var keys = Object.create(null);
  var touch = { active: false, x: 0, y: 0, action: false, sprint: false };
  var actionEdge = false;

  function keyVec() {
    var ix = 0, iy = 0;
    if (keys['a'] || keys['arrowleft'])  ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;
    if (keys['w'] || keys['arrowup'])    iy -= 1;
    if (keys['s'] || keys['arrowdown'])  iy += 1;
    if (touch.active) { ix += touch.x; iy += touch.y; }
    var m = Math.sqrt(ix * ix + iy * iy);
    if (m > 1) { ix /= m; iy /= m; }
    return { x: ix, y: iy, m: Math.min(m, 1) };
  }
  function actionHeld() { return !!(keys[' '] || keys['e'] || touch.action); }
  function sprintHeld() { return !!(keys['shift'] || touch.sprint); }

  function onKeyDown(e) {
    if (!g.active) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { BR.game.togglePause(); e.preventDefault(); return; }
    if (g.paused) return;
    if (!keys[k] && (k === ' ' || k === 'e')) actionEdge = true;
    keys[k] = true;
    if (k >= '1' && k <= '9') { BR.game.useSupply(parseInt(k, 10) - 1); e.preventDefault(); }
    if (k === ' ' || k.indexOf('arrow') === 0) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

  /* ------------------------------------------------------------------
     START / STOP
     ------------------------------------------------------------------ */
  function start(mission, packed) {
    g.mission = mission;
    g.map = BR.maps.make(mission);
    g.roster = BR.rescue.build(g.map, mission);
    g.aboard = [];
    g.inventory = BR.supplies.makeInventory(packed);
    g.parts = []; g.ping = null; g.shake = 0; g.time = 0;
    g.holdT = 0; g.holdTarget = null; g.dockHold = 0; g.dropCd = 0;
    g.ended = false; g.paused = false; g.active = true;

    g.missionState = {
      missionId: mission.id,
      waterLevel: 0,
      riseRate: 1 / mission.duration,
      score: 0, rescued: 0, lost: 0, trips: 0,
      total: g.roster.length,
      elapsed: 0,
      neverFound: 0,
      blockedAttempts: {},   // supplyId -> how many rescues it would have unlocked
      endedBy: null
    };

    g.boat = {
      x: g.map.spawn.x, y: g.map.spawn.y, px: g.map.spawn.x, py: g.map.spawn.y,
      vx: 0, vy: 0, ang: 0, pang: 0, stamina: 100, stagger: 0, wireCd: 0
    };
    g.cam = { x: g.boat.x, y: g.boat.y, px: g.boat.x, py: g.boat.y };

    g.weather.flash = 0;
    g.weather.nextFlash = mission.dark > 0.3 ? 7 : 999;
    g.weather.rain = mission.rain;
    buildRain();

    BR.hud.cache();
    BR.hud.mount(BR.game);
    BR.audio.startAmbience();
    BR.hud.banner(mission.fil.toUpperCase(), false, 2400);

    if (mission.dark > 0.3) {
      var missing = g.roster.filter(function (r) { return !r.found; }).length;
      setTimeout(function () {
        if (g.active) BR.hud.banner('RADIO: ' + missing + ' UNACCOUNTED FOR', false, 2600);
      }, 2600);
    }

    lastTs = 0; acc = 0;
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function stop() {
    g.active = false;
    BR.audio.stopAmbience();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    for (var k in keys) keys[k] = false;
    touch.active = false; touch.action = false; touch.sprint = false; touch.x = 0; touch.y = 0;
  }

  function togglePause() {
    if (!g.active || g.ended) return;
    g.paused = !g.paused;
    if (g.paused) BR.ui.openFloater('fl-pause');
    else BR.ui.closeFloater('fl-pause');
  }

  /* ------------------------------------------------------------------
     SUPPLIES
     ------------------------------------------------------------------ */
  function useSupply(i) {
    if (!g.active || g.paused || g.ended) return;
    var id = g.inventory.packed[i];
    if (!id) return;
    var def = BR.supplies.get(id), st = g.inventory.state[id];

    if (def.mode === 'toggle') {
      st.on = !st.on;
      g.inventory.used[id]++;
      BR.audio.play('torch');
      BR.hud.banner(def.fil + (st.on ? ' ON' : ' OFF'), st.on, 900);
    } else if (def.mode === 'charge') {
      if (st.charges <= 0) { BR.audio.play('deny'); BR.hud.banner('WALANG NATIRA · EMPTY', false, 900); return; }
      st.charges--; g.inventory.used[id]++;
      g.boat.stamina = 100;
      BR.audio.play('drink');
      BR.hud.banner('STAMINA REFILLED', true, 900);
    } else if (def.mode === 'cooldown') {
      if (st.cd > 0) { BR.audio.play('deny'); return; }
      st.cd = def.cooldown; g.inventory.used[id]++;
      firePing();
    } else {
      BR.hud.banner(def.fil.toUpperCase() + ' — PASSIVE', false, 1000);
    }
  }

  function firePing() {
    var best = null, bestD = Infinity;
    for (var i = 0; i < g.roster.length; i++) {
      var r = g.roster[i];
      if (r.state !== 'waiting') continue;
      var pref = r.found ? 1e6 : 0;     // strongly prefer someone not yet found
      var d = BR.dist2(r.x, r.y, g.boat.x, g.boat.y) + pref;
      if (d < bestD) { bestD = d; best = r; }
    }
    if (!best) { BR.hud.banner('WALANG SAGOT · NO RESPONSE', false, 1200); return; }
    g.ping = { target: best, t: 8 };
    BR.audio.play('ping');
    BR.hud.banner('RADYO: BEARING FIXED', true, 1200);
  }

  /* ------------------------------------------------------------------
     PHYSICS
     ------------------------------------------------------------------ */
  function passableCircle(x, y) {
    var wl = g.missionState.waterLevel;
    var pts = [[0, 0], [BOAT_R, 0], [-BOAT_R, 0], [0, BOAT_R], [0, -BOAT_R]];
    for (var i = 0; i < pts.length; i++) {
      if (!BR.maps.passableAt(g.map, x + pts[i][0], y + pts[i][1], wl)) return false;
    }
    return true;
  }

  function updateBoat(dt) {
    var b = g.boat;
    b.px = b.x; b.py = b.y; b.pang = b.ang;

    var iv = keyVec();
    var sprinting = sprintHeld() && b.stamina > 1 && iv.m > 0.15 && b.stagger <= 0;

    if (iv.m > 0.08) {
      var desired = Math.atan2(iv.y, iv.x);
      // Steering always responds, even mid-stagger. A knock costs you speed;
      // it must never cost you the ability to turn off the thing you hit,
      // or a clipped corner becomes an unrecoverable wedge.
      b.ang = BR.angleLerp(b.ang, desired, 1 - Math.exp(-TURN * dt));
      var align = Math.max(0, Math.cos(b.ang - desired));
      var thrust = ACCEL * iv.m * align * (sprinting ? SPRINT_MUL : 1) *
                   (b.stagger > 0 ? 0.38 : 1);
      b.vx += Math.cos(b.ang) * thrust * dt;
      b.vy += Math.sin(b.ang) * thrust * dt;
    }

    if (sprinting) b.stamina = Math.max(0, b.stamina - STAM_DRAIN * dt);
    else b.stamina = Math.min(100, b.stamina + STAM_REGEN * dt);

    // current + wind
    var cell = g.map.at(Math.floor(b.x / TILE), Math.floor(b.y / TILE));
    if (cell && (cell.cx || cell.cy)) {
      b.vx += cell.cx * dt * 1.8;
      b.vy += cell.cy * dt * 1.8;
    }
    b.vx += g.weather.windX * dt;
    b.vy += g.weather.windY * dt;

    // drag + clamp
    var damp = Math.exp(-DRAG * dt);
    b.vx *= damp; b.vy *= damp;
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var cap = MAX_SPD * (sprinting ? SPRINT_MUL : 1) * (b.stagger > 0 ? 0.4 : 1);
    if (sp > cap) { b.vx = b.vx / sp * cap; b.vy = b.vy / sp * cap; }

    if (b.stagger > 0) b.stagger -= dt;
    if (b.wireCd > 0) b.wireCd -= dt;

    // integrate, resolving each axis so a glancing hit slides along the wall.
    // The map clamp is applied to the candidate, never to an accepted
    // position — clamping afterwards could shove the hull into an edge tile
    // and wedge it there permanently.
    var nx = BR.clamp(b.x + b.vx * dt, TILE * 0.6, g.map.w - TILE * 0.6);
    if (passableCircle(nx, b.y)) b.x = nx;
    else { onImpact(sp); b.vx *= -0.22; }

    var ny = BR.clamp(b.y + b.vy * dt, TILE * 0.6, g.map.h - TILE * 0.6);
    if (passableCircle(b.x, ny)) b.y = ny;
    else { onImpact(sp); b.vy *= -0.22; }

    unstick();

    // live wire
    if (cell && cell.t === T.WIRE && b.wireCd <= 0) {
      b.wireCd = 2.2; b.stagger = 0.75;
      b.stamina = Math.max(0, b.stamina - 34);
      g.shake += 12;
      BR.audio.play('bump');
      BR.hud.banner('⚡ LIVE WIRE — STAY CLEAR', false, 1400);
      spawnSplash(b.x, b.y, 14);
    }

    // wake
    if (sp > 40 && Math.random() < 0.5) {
      spawnPart(b.x - Math.cos(b.ang) * 20, b.y - Math.sin(b.ang) * 20,
                (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.5, 3.5, 'rgba(228,250,255,.55)');
    }
  }

  /* Safety net: if the hull ever ends a step inside geometry — shoved there
     by a current, a stagger, or a roof that was passable a moment ago —
     spiral outward for the nearest legal water and put it back. Without
     this a single wedge is unrecoverable and the mission is dead. */
  function unstick() {
    var b = g.boat;
    if (passableCircle(b.x, b.y)) return;
    for (var r = 8; r <= 120; r += 8) {
      for (var a = 0; a < 16; a++) {
        var ang = (a / 16) * 6.2832;
        var nx = b.x + Math.cos(ang) * r, ny = b.y + Math.sin(ang) * r;
        if (passableCircle(nx, ny)) {
          b.x = nx; b.y = ny;
          b.vx *= 0.15; b.vy *= 0.15;
          return;
        }
      }
    }
  }

  function onImpact(sp) {
    if (sp < 110 || g.boat.stagger > 0) return;
    g.boat.stagger = 0.4;
    g.shake += Math.min(16, sp * 0.09);
    BR.audio.play('bump');
    spawnSplash(g.boat.x, g.boat.y, 10);

    // At near-full speed someone can go over the side. Deliberately rare:
    // it should read as "that was my fault", not as a tax on every corner.
    if (g.aboard.length && sp > 168 && Math.random() < 0.15) {
      var r = g.aboard.pop();
      r.state = 'waiting';
      r.situation = 'water';
      r.need = '🛟';
      r.found = true;
      r.timer = r.timerMax = BR.rescue.WATER_GRACE;
      r.x = g.boat.x - Math.cos(g.boat.ang) * 30;
      r.y = g.boat.y - Math.sin(g.boat.ang) * 30;
      BR.hud.banner('NAHULOG SI ' + r.name.toUpperCase() + '!', false, 2000);
      BR.audio.play('lost');
    }
  }

  /* ------------------------------------------------------------------
     PARTICLES
     ------------------------------------------------------------------ */
  function spawnPart(x, y, vx, vy, life, r, col) {
    if (g.parts.length > 240) return;
    g.parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, r: r, col: col });
  }
  function spawnSplash(x, y, n) {
    var mul = BR.state.settings.reduceMotion ? 0.4 : 1;
    for (var i = 0; i < n * mul; i++) {
      var a = Math.random() * 6.2832, s = 40 + Math.random() * 90;
      spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.3,
                2 + Math.random() * 3, 'rgba(228,250,255,.8)');
    }
    BR.audio.play('splash', BR.clamp((x - g.boat.x) / 400, -1, 1));
  }
  function spawnCheer(x, y) {
    var mul = BR.state.settings.reduceMotion ? 0.35 : 1;
    var cols = ['#F6A623', '#57B01A', '#4C8FB8', '#E9553C', '#FFF3D6'];
    for (var i = 0; i < 26 * mul; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 70 + Math.random() * 150;
      spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.8 + Math.random() * 0.5,
                2.5 + Math.random() * 3, cols[i % cols.length]);
    }
  }

  function updateParts(dt) {
    for (var i = g.parts.length - 1; i >= 0; i--) {
      var p = g.parts[i];
      p.life -= dt;
      if (p.life <= 0) { g.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
    }
  }

  /* ------------------------------------------------------------------
     WEATHER
     ------------------------------------------------------------------ */
  function buildRain() {
    g.rain = [];
    var reduce = BR.state.settings.reduceMotion;
    var n = Math.round((reduce ? 90 : 320) * (0.35 + g.mission.rain));
    for (var i = 0; i < n; i++) {
      g.rain.push({
        x: Math.random(), y: Math.random(),
        len: 10 + Math.random() * 22, spd: 0.55 + Math.random() * 0.7
      });
    }
  }

  function updateWeather(dt) {
    var ms = g.missionState, w = g.weather;
    var tension = BR.clamp(ms.waterLevel, 0, 1);
    w.rain = BR.clamp(g.mission.rain * (0.7 + tension * 0.8), 0, 1.4);

    w.windT += dt;
    var wind = g.mission.wind * (0.6 + tension * 0.9) * 34;
    w.windX = Math.cos(w.windT * 0.31) * wind;
    w.windY = Math.sin(w.windT * 0.22) * wind * 0.55;

    if (w.flash > 0) w.flash = Math.max(0, w.flash - dt * 2.4);
    w.nextFlash -= dt;
    if (w.nextFlash <= 0) {
      w.nextFlash = BR.lerp(16, 6, tension) + Math.random() * 6;
      w.flash = 1;
      BR.audio.play('thunder');
      // A lightning flash lights the whole scene, but it only fixes someone's
      // position in your memory if they were close enough to make out. Keep
      // this radius tight: revealing the neighbourhood every few seconds would
      // do the flashlight's job for free and gut the lesson of Mission 2.
      for (var i = 0; i < g.roster.length; i++) {
        var r = g.roster[i];
        if (r.state === 'waiting' && BR.dist(r.x, r.y, g.boat.x, g.boat.y) < 380) r.found = true;
      }
    }

    BR.audio.setAmbience(w.rain, tension);
  }

  /* ------------------------------------------------------------------
     VISION — who the player can actually see
     ------------------------------------------------------------------ */
  function visionParams() {
    var m = g.mission, inv = g.inventory;
    var hasTorch = inv.packed.indexOf('flashlight') !== -1 && inv.state.flashlight && inv.state.flashlight.on;
    var hasCoat = inv.packed.indexOf('kapote') !== -1;

    var rainPenalty = g.weather.rain * (hasCoat ? 0.10 : 0.26);
    // Unpacked, you are squinting down a short narrow beam; packed, the cone is
    // ~3x longer and twice as wide. That gap is the whole argument of Mission 2.
    var len = (hasTorch ? 470 : 150) * (1 - rainPenalty);
    var half = hasTorch ? 0.98 : 0.44;
    var halo = hasTorch ? 130 : 72;         // the little pool of light around the boat
    return { len: len, half: half, halo: halo, dark: m.dark, torch: hasTorch };
  }

  function updateVision(dt) {
    if (g.mission.dark < 0.3) return;
    var v = visionParams(), b = g.boat;
    for (var i = 0; i < g.roster.length; i++) {
      var r = g.roster[i];
      if (r.found || r.state !== 'waiting') continue;
      var d = BR.dist(r.x, r.y, b.x, b.y);
      if (d < v.halo) { r.found = true; continue; }
      if (d < v.len) {
        var a = Math.atan2(r.y - b.y, r.x - b.x);
        var da = Math.abs(((a - b.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < v.half) { r.found = true; BR.hud.banner('NAKITA: ' + r.name.toUpperCase(), true, 1200); }
      }
    }
  }

  /* ------------------------------------------------------------------
     RESCUE INTERACTION
     ------------------------------------------------------------------ */
  function nearestTarget() {
    var best = null, bestD = REACH * REACH;
    for (var i = 0; i < g.roster.length; i++) {
      var r = g.roster[i];
      if (r.state !== 'waiting') continue;
      if (!r.found && g.mission.dark >= 0.3) continue;
      var d = BR.dist2(r.x, r.y, g.boat.x, g.boat.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  function updateInteraction(dt) {
    var b = g.boat, ms = g.missionState;
    var onDock = isOnDock(b.x, b.y);

    // ---- automatic drop-off at the evacuation center ----
    g.dropCd -= dt;
    if (onDock && g.aboard.length && g.dropCd <= 0) {
      var r = g.aboard.shift();
      r.state = 'safe';
      ms.rescued++;
      var bonus = g.inventory.packed.indexOf('relief') !== -1 ? 30 : 0;
      ms.score += r.score + bonus;
      if (bonus) g.inventory.used.relief = (g.inventory.used.relief || 0) + 1;
      g.dropCd = 0.3;
      spawnCheer(b.x, b.y);
      BR.audio.play('dropoff');
      BR.hud.banner('LIGTAS SI ' + r.name.toUpperCase() + '! +' + (r.score + bonus), true, 1300);
      if (g.aboard.length === 0) ms.trips++;
    }

    // ---- call it in ----
    if (onDock && g.aboard.length === 0 && actionHeld() && !g.ended) {
      g.dockHold += dt;
      BR.hud.setCtx('Hold <em>E</em> to call it in — end the mission', BR.clamp(g.dockHold / 1.5, 0, 1));
      if (g.dockHold >= 1.5) { finish('called'); return; }
    } else {
      g.dockHold = 0;
    }

    // ---- rescue ----
    var target = nearestTarget();
    if (!target) {
      if (!onDock) BR.hud.setCtx('');
      else if (g.aboard.length === 0 && !actionHeld()) {
        BR.hud.setCtx('<em>Evacuation Center</em> — hold E to call it in');
      }
      g.holdT = 0; g.holdTarget = null;
      actionEdge = false;
      return;
    }

    var verdict = BR.rescue.canRescue(target, g.inventory, g.aboard.length >= CAPACITY);

    if (!verdict.ok) {
      BR.hud.setCtx('<span class="bad">' + (verdict.reason || 'Cannot reach') + '</span>');
      // remember what the player could not do, for the after-action report
      if (verdict.reason) {
        var miss = BR.rescue.blockedBy(target, g.inventory.packed);
        for (var mi = 0; mi < miss.length; mi++) {
          ms.blockedAttempts[miss[mi]] = ms.blockedAttempts[miss[mi]] || {};
          ms.blockedAttempts[miss[mi]][target.id] = true;
        }
      }
      g.holdT = 0; g.holdTarget = null;
      actionEdge = false;
      return;
    }

    if (verdict.hold) {
      if (actionHeld()) {
        if (g.holdTarget !== target) { g.holdT = 0; g.holdTarget = target; }
        g.holdT += dt;
        BR.hud.setCtx('Stabilising <em>' + target.name + '</em> with the Botika…', g.holdT / verdict.hold);
        if (g.holdT >= verdict.hold) {
          target.stabilised = true;
          g.inventory.used.botika = (g.inventory.used.botika || 0) + 1;
          BR.audio.play('stabilise');
          g.holdT = 0;
          board(target);
        }
      } else {
        g.holdT = 0; g.holdTarget = null;
        BR.hud.setCtx('Hold <em>E</em> — ' + target.name + ' is injured 🩹');
      }
    } else {
      BR.hud.setCtx('Press <em>E</em> to take ' + target.name + ' aboard ' +
                    (BR.art.TAG_ICON[target.tag] || ''));
      if (actionEdge) board(target);
    }
    actionEdge = false;
  }

  function board(r) {
    r.state = 'aboard';
    g.aboard.push(r);
    BR.audio.play('rescue');
    spawnSplash(r.x, r.y, 6);
    BR.hud.banner('SAKAY NA SI ' + r.name.toUpperCase(), true, 1100);
    if (g.aboard.length >= CAPACITY) {
      BR.hud.banner('PUNO NA · BOAT FULL — RUN THEM IN', false, 1700);
    }
  }

  function isOnDock(x, y) {
    var c = g.map.at(Math.floor(x / TILE), Math.floor(y / TILE));
    return !!c && c.t === T.DOCK;
  }

  /* ------------------------------------------------------------------
     MISSION END
     ------------------------------------------------------------------ */
  function finish(cause) {
    if (g.ended) return;
    g.ended = true;
    g.missionState.endedBy = cause;

    // anyone still waiting when the mission ends is counted as not reached
    for (var i = 0; i < g.roster.length; i++) {
      var r = g.roster[i];
      if (r.state === 'waiting') {
        r.state = 'lost';
        r.lostTo = r.found ? 'time' : 'unfound';
        if (!r.found) g.missionState.neverFound++;
        g.missionState.lost++;
      } else if (r.state === 'aboard') {
        // aboard but never delivered — they made it, but not to safety
        r.state = 'lost'; r.lostTo = 'undelivered';
        g.missionState.lost++;
      }
    }

    BR.audio.play(g.missionState.rescued > g.missionState.lost ? 'win' : 'fail');
    var self = BR.game;
    setTimeout(function () {
      self.stop();
      BR.report.show(g.mission, g.missionState, g.roster, g.inventory);
    }, 900);
  }

  function checkEnd() {
    var ms = g.missionState;
    if (g.ended) return;
    if (ms.waterLevel >= 1) { BR.hud.banner('UMAPAW NA ANG TUBIG', false, 2200); finish('flood'); return; }
    var open = 0;
    for (var i = 0; i < g.roster.length; i++) if (g.roster[i].state === 'waiting') open++;
    if (open === 0 && g.aboard.length === 0) finish('cleared');
  }

  /* ------------------------------------------------------------------
     TICK
     ------------------------------------------------------------------ */
  function update(dt) {
    var ms = g.missionState;
    ms.elapsed += dt;
    ms.waterLevel = BR.clamp(ms.waterLevel + ms.riseRate * dt, 0, 1);

    var wasCrit = g.critAnnounced;
    if (!wasCrit && ms.waterLevel >= CRITICAL) {
      g.critAnnounced = true;
      BR.hud.banner('KRITIKAL ANG TUBIG · WATER CRITICAL', false, 2400);
      BR.audio.play('alarm');
    }

    updateBoat(dt);
    updateWeather(dt);
    updateVision(dt);

    BR.rescue.update(dt, {
      roster: g.roster, map: g.map, missionState: ms, boat: g.boat,
      onLost: function (r) {
        BR.hud.banner('NAWALA SI ' + r.name.toUpperCase(), false, 1800);
        BR.audio.play('lost');
      },
      onWorsen: function (r) {
        if (BR.dist(r.x, r.y, g.boat.x, g.boat.y) < 700) {
          BR.hud.banner(r.name.toUpperCase() + ' SLIPPED INTO THE WATER', false, 1600);
          spawnSplash(r.x, r.y, 8);
        }
      }
    });

    updateInteraction(dt);
    updateParts(dt);

    if (g.ping) { g.ping.t -= dt; if (g.ping.t <= 0 || g.ping.target.state !== 'waiting') g.ping = null; }

    var inv = g.inventory;
    for (var id in inv.state) { if (inv.state[id].cd > 0) inv.state[id].cd = Math.max(0, inv.state[id].cd - dt); }

    // camera
    g.cam.px = g.cam.x; g.cam.py = g.cam.y;
    g.cam.x = BR.lerp(g.cam.x, g.boat.x, 1 - Math.exp(-6 * dt));
    g.cam.y = BR.lerp(g.cam.y, g.boat.y, 1 - Math.exp(-6 * dt));

    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 34);

    g.time += dt;
    checkEnd();
  }

  /* ------------------------------------------------------------------
     LOOP — fixed timestep with an accumulator, interpolated render
     ------------------------------------------------------------------ */
  var rafId = 0, lastTs = 0, acc = 0;

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (!g.active) return;

    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, MAX_FRAME);
    lastTs = ts;

    if (!g.paused && !g.ended) {
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }
    }

    BR.render.draw(g, g.paused || g.ended ? 1 : acc / STEP);
    if (!g.paused) BR.hud.update(BR.game);
  }

  /* ------------------------------------------------------------------ */
  BR.game = g;
  g.start = start;
  g.stop = stop;
  g.togglePause = togglePause;
  g.useSupply = useSupply;
  g.finish = finish;
  g.bindInput = function () {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  };
  g.touch = touch;
  g.setActionEdge = function () { actionEdge = true; };
  g.visionParams = visionParams;

})(window.BR);
