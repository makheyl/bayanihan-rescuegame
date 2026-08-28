/* =====================================================================
   rescue.js — the roster: who is out there, what it takes to reach them,
   and what happens when nobody does.
   ===================================================================== */
(function (BR) {
  'use strict';

  var T = BR.maps.T, TILE = BR.maps.TILE;

  var NAMES = [
    'Aling Rosa', 'Mang Tonyo', 'Lola Bining', 'Lolo Idad', 'Nene', 'Totoy',
    'Aling Delia', 'Kuya Boyet', 'Ate Marilou', 'Mang Ambo', 'Bunso',
    'Aling Puring', 'Tatay Cesar', 'Nanay Luz', 'Jun-jun', 'Lola Sela',
    'Mang Berting', 'Ate Ising'
  ];

  /* Higher priority = more points and a shorter fuse. That is the whole
     triage lesson expressed as two numbers. */
  var TAGS = {
    injured: { score: 220, timer: 118 },
    elderly: { score: 170, timer: 140 },
    child:   { score: 160, timer: 152 },
    adult:   { score: 100, timer: 215 }
  };

  /* Seconds you get once someone has slipped into the water. Long enough
     that a lifebuoy is a rescue and not a formality; short enough that
     letting a roof timer run out still costs you. */
  var WATER_GRACE = 58;

  var NEED_PIP = { water: '🛟', debris: '🪢', injured: '🩹' };

  function build(map, mission) {
    var R = BR.rng(mission.seed ^ 0x5EED);
    var roster = [];
    var spec = mission.roster;
    var names = R.shuffle(NAMES.slice());

    var roofSpots = [], waterSpots = [], debrisSpots = [];

    // --- catalogue every legal spawn point -------------------------------
    for (var i = 0; i < map.cells.length; i++) {
      var c = map.cells[i];
      var wx = c.x * TILE + TILE / 2, wy = c.y * TILE + TILE / 2;
      if (BR.dist(wx, wy, map.dockCx, map.dockCy) < TILE * 4) continue;

      if (c.t === T.ROOF && touchesOpenWater(map, c)) {
        roofSpots.push(c);
      } else if (c.t === T.WATER && !c.cx && !c.cy && touchesOpenWater(map, c)) {
        if (nextToDebris(map, c)) debrisSpots.push(c);
        else waterSpots.push(c);
      }
    }

    R.shuffle(waterSpots); R.shuffle(debrisSpots);

    // Spread the roof residents across the whole range of house heights
    // rather than piling them onto the lowest roofs. The first one or two
    // are genuinely racing the flood; the last is on a slab that never goes
    // under. That ladder is what makes reading the water gauge worth doing.
    R.shuffle(roofSpots);
    roofSpots.sort(function (a, b) { return a.elev - b.elev; });

    var nWater = Math.min(spec.water, waterSpots.length);
    var nDebris = Math.min(spec.debris, debrisSpots.length);
    var nRoof = Math.max(0, spec.total - nWater - nDebris);

    var injuredLeft = spec.injured;
    var id = 0;

    function tagFor(situation) {
      // injured residents are spread across situations, then the rest get
      // a mix weighted toward the vulnerable
      if (injuredLeft > 0 && R.chance(0.55)) { injuredLeft--; return 'injured'; }
      var roll = R.f();
      if (roll < 0.26) return 'elderly';
      if (roll < 0.52) return 'child';
      return 'adult';
    }

    function push(cell, situation) {
      var tag = tagFor(situation);
      var t = TAGS[tag];
      var need = situation === 'water' ? NEED_PIP.water
               : situation === 'debris' ? NEED_PIP.debris
               : (tag === 'injured' ? NEED_PIP.injured : null);
      roster.push({
        id: 'r' + (id++),
        name: names[id % names.length] || 'Kapitbahay',
        tag: tag,
        situation: situation,
        state: 'waiting',                       // waiting | aboard | safe | lost
        cell: cell,
        x: cell.x * TILE + TILE / 2 + R.range(-8, 8),
        y: cell.y * TILE + TILE / 2 + R.range(-8, 8),
        score: t.score,
        timer: t.timer, timerMax: t.timer,
        need: need,
        found: mission.dark < 0.3,              // daylight: everyone is visible
        stabilised: false,
        seed: R.range(0, 6.28),
        skin: BR.art.P.skin[R.int(0, BR.art.P.skin.length - 1)],
        shirt: BR.art.P.shirt[R.int(0, BR.art.P.shirt.length - 1)],
        callCd: R.range(0, 4)
      });
    }

    var k;
    for (k = 0; k < nWater; k++) push(waterSpots[k], 'water');
    for (k = 0; k < nDebris; k++) push(debrisSpots[k], 'debris');

    var taken = {};
    for (k = 0; k < nRoof && roofSpots.length; k++) {
      var frac = nRoof <= 1 ? 0.5 : (k / (nRoof - 1));
      var want = Math.floor((0.08 + frac * 0.84) * roofSpots.length);
      want = Math.min(roofSpots.length - 1, Math.max(0, want));
      while (taken[want] && want < roofSpots.length - 1) want++;
      while (taken[want] && want > 0) want--;
      if (taken[want]) break;
      taken[want] = true;
      push(roofSpots[want], 'roof');
    }

    // injured that never got assigned: promote the nearest able-bodied
    for (var m = 0; m < roster.length && injuredLeft > 0; m++) {
      if (roster[m].tag === 'adult') {
        roster[m].tag = 'injured';
        roster[m].score = TAGS.injured.score;
        roster[m].timer = roster[m].timerMax = TAGS.injured.timer;
        if (roster[m].situation === 'roof') roster[m].need = NEED_PIP.injured;
        injuredLeft--;
      }
    }

    return roster;
  }

  function touchesOpenWater(map, c) {
    var d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var n = map.at(c.x + d[i][0], c.y + d[i][1]);
      if (n && (n.t === T.WATER || n.t === T.DOCK)) return true;
    }
    return false;
  }

  function nextToDebris(map, c) {
    var d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < 4; i++) {
      var n = map.at(c.x + d[i][0], c.y + d[i][1]);
      if (n && n.t === T.DEBRIS) return true;
    }
    return false;
  }

  /* --------------------------------------------------------------------
     Can this resident be taken right now?
     Returns { ok, hold, reason } — `hold` marks a rescue that needs the
     action key held (stabilising an injured resident).
     -------------------------------------------------------------------- */
  function canRescue(res, inv, boatFull) {
    if (res.state !== 'waiting') return { ok: false, reason: '' };
    if (boatFull) return { ok: false, reason: 'Puno ang bangka — boat is full. Run them to the evacuation center.' };

    var has = function (id) { return inv.packed.indexOf(id) !== -1; };

    if (res.situation === 'water' && !has('salbabida')) {
      return { ok: false, reason: 'They are in open water. You needed the <em>Salbabida</em>.' };
    }
    if (res.situation === 'debris' && !has('lubid')) {
      return { ok: false, reason: 'Trapped behind debris. You needed the <em>Lubid</em>.' };
    }
    if (res.tag === 'injured' && !res.stabilised) {
      if (!has('botika')) {
        return { ok: false, reason: 'Injured and cannot board. You needed the <em>Botika</em>.' };
      }
      return { ok: true, hold: 2.0, reason: 'Hold to stabilise with the Botika' };
    }
    return { ok: true, hold: 0, reason: '' };
  }

  /* What the resident is still missing, for the report's prep linkage. */
  function blockedBy(res, packed) {
    var missing = [];
    if (res.situation === 'water' && packed.indexOf('salbabida') === -1) missing.push('salbabida');
    if (res.situation === 'debris' && packed.indexOf('lubid') === -1) missing.push('lubid');
    if (res.tag === 'injured' && packed.indexOf('botika') === -1) missing.push('botika');
    return missing;
  }

  /* --------------------------------------------------------------------
     Per-frame roster update: personal timers, roofs going under, and the
     calls for help that let a player without a radio still find people.
     -------------------------------------------------------------------- */
  function update(dt, ctxObj) {
    var roster = ctxObj.roster, map = ctxObj.map, ms = ctxObj.missionState;
    var boat = ctxObj.boat;

    for (var i = 0; i < roster.length; i++) {
      var r = roster[i];
      if (r.state !== 'waiting') continue;

      // the roof goes under -> the person on it is lost
      if (r.situation === 'roof' && r.cell.t === T.ROOF) {
        if (BR.maps.submergence(r.cell, ms.waterLevel) >= 1) {
          r.state = 'lost'; r.lostTo = 'submerged';
          ms.lost++;
          ctxObj.onLost(r);
          continue;
        }
      }

      // personal timer
      r.timer -= dt;
      if (r.timer <= 0) {
        if (r.situation === 'roof' || r.situation === 'debris') {
          // they slip into the water: still savable, but only with a lifebuoy
          r.situation = 'water';
          r.need = NEED_PIP.water;
          r.timer = r.timerMax = WATER_GRACE;
          ctxObj.onWorsen(r);
        } else {
          r.state = 'lost'; r.lostTo = 'current';
          ms.lost++;
          ctxObj.onLost(r);
          continue;
        }
      }

      // calls for help — audible before they are visible
      var d = BR.dist(r.x, r.y, boat.x, boat.y);
      if (d < 620) {
        r.callCd -= dt;
        if (r.callCd <= 0) {
          r.callCd = BR.lerp(1.6, 5.0, BR.clamp(d / 620, 0, 1)) + Math.random() * 0.8;
          var vol = Math.pow(1 - BR.clamp(d / 620, 0, 1), 1.6);
          if (vol > 0.05 && !r.found) {
            var pan = BR.clamp((r.x - boat.x) / 420, -1, 1);
            BR.audio.play('help', pan, vol);
          }
        }
      }
    }
  }

  BR.rescue = {
    TAGS: TAGS,
    WATER_GRACE: WATER_GRACE,
    build: build,
    canRescue: canRescue,
    blockedBy: blockedBy,
    update: update
  };

})(window.BR);
