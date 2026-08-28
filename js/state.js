/* =====================================================================
   state.js — session state + small shared helpers
   =====================================================================
   Everything here is a plain serializable object on purpose: missionState,
   roster and inventory could be JSON.stringify'd and shipped to a server
   for co-op or a leaderboard without restructuring anything.

   PERSISTENCE: deliberately in-memory only. localStorage is unavailable in
   some sandboxed preview contexts and throws on some file:// origins, so it
   is not used anywhere in this build. A persistence layer would slot in at
   exactly two points marked >>> PERSIST <<< below: hydrate on boot, and
   write after each mutation.
   ===================================================================== */
window.BR = window.BR || {};

(function (BR) {
  'use strict';

  var settings = {
    master: 0.80,
    sfx: 0.90,
    music: 0.50,
    reduceMotion: false
  };

  var progress = {
    unlocked: 1,          // highest mission index (1-based) the player may enter
    best: {}              // best[missionId] = { stars, score, rescued, total }
  };

  var loadout = {
    missionId: null,
    packed: []            // array of supply ids, max = mission.slots
  };

  var lastReport = null;  // populated by report.js, read by the report screen

  // >>> PERSIST <<<  hydrate(saved) would run here on boot.

  BR.state = {
    settings: settings,
    progress: progress,
    loadout: loadout,

    getReport: function () { return lastReport; },
    setReport: function (r) { lastReport = r; /* >>> PERSIST <<< */ },

    unlock: function (n) {
      if (n > progress.unlocked) progress.unlocked = n;   // >>> PERSIST <<<
    },

    recordBest: function (missionId, result) {
      var prev = progress.best[missionId];
      if (!prev || result.score > prev.score) {
        progress.best[missionId] = {
          stars: result.stars,
          score: result.score,
          rescued: result.rescued,
          total: result.total
        };                                                // >>> PERSIST <<<
      } else if (result.stars > prev.stars) {
        prev.stars = result.stars;
      }
    },

    applyReduceMotion: function () {
      document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);
    }
  };

  /* ---------------------------------------------------------------
     Deterministic RNG (mulberry32) — every map and roster is
     reproducible from its mission seed, so a defence demo always
     shows the same barangay.
     --------------------------------------------------------------- */
  BR.rng = function (seed) {
    var a = seed >>> 0;
    function next() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      f: next,
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      int: function (lo, hi) { return Math.floor(lo + next() * (hi - lo + 1)); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
  };

  /* --------------------------- math helpers --------------------------- */
  BR.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  BR.lerp  = function (a, b, t) { return a + (b - a) * t; };
  BR.dist  = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  BR.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

  BR.angleLerp = function (a, b, t) {
    var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  };

  BR.fmtTime = function (sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  /* --------------------------- toast --------------------------- */
  var toastHost = null;
  BR.toast = function (msg, kind, ms) {
    if (!toastHost) toastHost = document.getElementById('toast');
    if (!toastHost) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s'; el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, ms || 2200);
  };

})(window.BR);
