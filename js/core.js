/* =========================================================================
   TERRAQUA CLASH — core.js
   Shared namespace: utils, persisted settings, match hand-off between pages,
   a tiny WebAudio SFX synth, floater (modal) controller and toasts.

   NOTE ON file:// — this build must run by double-clicking index.html, so:
     * classic <script> tags only (ES modules are blocked by CORS on file://)
     * no fetch() of local JSON
     * cross-page state travels in the URL query string, with localStorage
       used only as a convenience mirror (it can throw on file:// origins)
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ || (global.TQ = {});

  /* ---------------------------------------------------------------- utils */
  var U = TQ.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    inv: function (v, a, b) { return (v - a) / (b - a); },
    dist: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
    dist2: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    // deterministic RNG so a terrain's island shape is identical every match
    seeded: function (seed) {
      var s = seed >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    // smooth approach independent of frame rate
    damp: function (a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    fmtTime: function (sec) {
      sec = Math.max(0, sec);
      var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
    esc: function (str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
  };

  /* ------------------------------------------------------------- storage */
  var mem = {};
  var store = TQ.store = {
    get: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem('tq.' + key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) { /* file:// origin may deny access — fall through */ }
      return (key in mem) ? mem[key] : fallback;
    },
    set: function (key, value) {
      mem[key] = value;
      try { global.localStorage.setItem('tq.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
      return value;
    }
  };

  /* ------------------------------------------------------------ settings */
  var SETTINGS_DEFAULTS = {
    volume: 0.6,
    muted: false,
    roundLength: 90,   // seconds
    tideSpeed: 1,      // multiplier on each terrain's tide period
    particles: true,
    screenShake: true,
    showNames: true
  };

  TQ.settings = (function () {
    var cur = Object.assign({}, SETTINGS_DEFAULTS, store.get('settings', {}));
    return {
      defaults: SETTINGS_DEFAULTS,
      all: function () { return cur; },
      get: function (k) { return cur[k]; },
      set: function (k, v) { cur[k] = v; store.set('settings', cur); return v; },
      reset: function () { cur = Object.assign({}, SETTINGS_DEFAULTS); store.set('settings', cur); return cur; }
    };
  }());

  /* --------------------------------------------------------- match config
     What a match needs to start. Written by character-select / terrain-select,
     read by game.html. Travels via the query string so it survives file://.  */
  var MATCH_DEFAULTS = {
    terrain: 'reef',
    humans: 2,          // 1–4 local players on one keyboard
    bots: 2,            // AI opponents filling the rest
    picks: ['nanuq', 'waddles', 'kuya', 'bruno']  // one animal id per seat
  };

  TQ.match = (function () {
    function read() {
      var cfg = Object.assign({}, MATCH_DEFAULTS, store.get('match', {}));
      try {
        var q = new URLSearchParams(global.location.search);
        if (q.has('terrain')) cfg.terrain = q.get('terrain');
        if (q.has('humans')) cfg.humans = U.clamp(parseInt(q.get('humans'), 10) || 1, 1, 4);
        if (q.has('bots')) cfg.bots = U.clamp(parseInt(q.get('bots'), 10) || 0, 0, 3);
        if (q.has('picks')) {
          var p = q.get('picks').split(',').filter(Boolean);
          if (p.length) cfg.picks = p;
        }
      } catch (e) { /* URLSearchParams unavailable — stick with stored config */ }
      // never let seats exceed 4 total
      if (cfg.humans + cfg.bots > 4) cfg.bots = Math.max(0, 4 - cfg.humans);
      return cfg;
    }
    var cur = read();
    return {
      all: function () { return cur; },
      get: function (k) { return cur[k]; },
      set: function (k, v) { cur[k] = v; store.set('match', cur); return v; },
      merge: function (obj) { Object.assign(cur, obj); store.set('match', cur); return cur; },
      reload: function () { cur = read(); return cur; },
      // serialise for the next page's URL
      query: function (extra) {
        var c = Object.assign({}, cur, extra || {});
        return 'terrain=' + encodeURIComponent(c.terrain) +
          '&humans=' + c.humans + '&bots=' + c.bots +
          '&picks=' + encodeURIComponent(c.picks.join(','));
      }
    };
  }());

  /* ------------------------------------------------------------ navigate */
  TQ.nav = {
    go: function (page, extra) {
      TQ.sfx.play('click');
      var q = TQ.match.query(extra);
      setTimeout(function () { global.location.href = page + '?' + q; }, 90);
    },
    back: function (page) {
      TQ.sfx.play('back');
      setTimeout(function () { global.location.href = page + '?' + TQ.match.query(); }, 90);
    }
  };

  /* ----------------------------------------------------------------- SFX
     Synthesised with WebAudio so the build ships with zero audio files and
     the Settings volume slider controls something real.                     */
  TQ.sfx = (function () {
    var ctx = null, master = null, ready = false;

    function ensure() {
      if (ready) return true;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = TQ.settings.get('muted') ? 0 : TQ.settings.get('volume');
        master.connect(ctx.destination);
        ready = true;
      } catch (e) { return false; }
      return true;
    }

    function tone(opts) {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime + (opts.delay || 0);
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(opts.f0, t0);
      if (opts.f1 && opts.f1 !== opts.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain || 0.2), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + opts.dur + 0.02);
    }

    function noise(opts) {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime + (opts.delay || 0);
      var len = Math.floor(ctx.sampleRate * opts.dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var filt = ctx.createBiquadFilter();
      filt.type = opts.filter || 'lowpass';
      filt.frequency.setValueAtTime(opts.f0 || 1200, t0);
      if (opts.f1) filt.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
      var g = ctx.createGain(); g.gain.value = opts.gain || 0.15;
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + opts.dur);
    }

    var BANK = {
      click:     function () { tone({ type: 'triangle', f0: 620, f1: 900, dur: 0.09, gain: 0.16 }); },
      back:      function () { tone({ type: 'triangle', f0: 520, f1: 300, dur: 0.11, gain: 0.15 }); },
      hover:     function () { tone({ type: 'sine', f0: 900, f1: 1050, dur: 0.05, gain: 0.05 }); },
      select:    function () { tone({ type: 'square', f0: 660, dur: 0.07, gain: 0.1 }); tone({ type: 'square', f0: 990, dur: 0.1, gain: 0.09, delay: 0.07 }); },
      deny:      function () { tone({ type: 'sawtooth', f0: 200, f1: 120, dur: 0.16, gain: 0.12 }); },
      pickup:    function () { tone({ type: 'sine', f0: 880, dur: 0.07, gain: 0.14 }); tone({ type: 'sine', f0: 1320, dur: 0.09, gain: 0.12, delay: 0.06 }); tone({ type: 'sine', f0: 1760, dur: 0.12, gain: 0.1, delay: 0.12 }); },
      hit:       function () { noise({ dur: 0.13, f0: 2400, f1: 260, gain: 0.22 }); tone({ type: 'square', f0: 180, f1: 90, dur: 0.12, gain: 0.14 }); },
      dash:      function () { noise({ dur: 0.16, f0: 700, f1: 3000, filter: 'bandpass', gain: 0.14 }); },
      splash:    function () { noise({ dur: 0.42, f0: 3200, f1: 320, gain: 0.2 }); tone({ type: 'sine', f0: 420, f1: 140, dur: 0.35, gain: 0.1 }); },
      tide:      function () { tone({ type: 'sawtooth', f0: 110, f1: 165, dur: 0.85, gain: 0.11 }); tone({ type: 'sine', f0: 220, f1: 330, dur: 0.9, gain: 0.07, delay: 0.05 }); noise({ dur: 1.1, f0: 500, f1: 1800, gain: 0.07 }); },
      eliminate: function () { tone({ type: 'triangle', f0: 500, f1: 90, dur: 0.5, gain: 0.16 }); },
      countdown: function () { tone({ type: 'square', f0: 740, dur: 0.1, gain: 0.13 }); },
      go:        function () { tone({ type: 'square', f0: 1180, dur: 0.28, gain: 0.16 }); },
      win:       function () { [523, 659, 784, 1046].forEach(function (f, i) { tone({ type: 'triangle', f0: f, dur: 0.34, gain: 0.15, delay: i * 0.11 }); }); },
      freeze:    function () { tone({ type: 'sine', f0: 1800, f1: 600, dur: 0.3, gain: 0.1 }); noise({ dur: 0.3, f0: 5000, f1: 1200, filter: 'highpass', gain: 0.08 }); }
    };

    return {
      play: function (name) {
        if (TQ.settings.get('muted')) return;
        var fn = BANK[name];
        if (fn) { try { fn(); } catch (e) { /* audio is non-essential */ } }
      },
      applyVolume: function () {
        if (!ready) return;
        master.gain.value = TQ.settings.get('muted') ? 0 : TQ.settings.get('volume');
      },
      unlock: function () { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
    };
  }());

  /* --------------------------------------------------------------- toast */
  var toastEl = null, toastTimer = 0;
  TQ.toast = function (msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, ms || 2200);
  };

  /* ------------------------------------------------------------- floaters
     Every landing-page button that isn't a page navigation opens one of
     these, so no button is a dead end.                                     */
  TQ.floater = (function () {
    var openId = null, lastFocus = null;

    function root(id) { return document.getElementById(id); }

    function open(id) {
      var el = root(id);
      if (!el) return;
      if (openId && openId !== id) close(openId, true);
      lastFocus = document.activeElement;
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      openId = id;
      document.body.setAttribute('data-floater-open', 'true');
      var focusable = el.querySelector('[data-autofocus]') || el.querySelector('.floater__close');
      if (focusable) focusable.focus();
      TQ.sfx.play('click');
    }

    function close(id, silent) {
      var el = root(id || openId);
      if (!el) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      if ((id || openId) === openId) {
        openId = null;
        document.body.removeAttribute('data-floater-open');
      }
      if (!silent) TQ.sfx.play('back');
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
    }

    // wire scrims, close buttons, [data-floater] openers, Escape, focus trap
    function init() {
      document.addEventListener('click', function (ev) {
        var opener = ev.target.closest('[data-floater]');
        if (opener) { ev.preventDefault(); open(opener.getAttribute('data-floater')); return; }
        var closer = ev.target.closest('[data-floater-close]');
        if (closer) {
          ev.preventDefault();
          var host = closer.closest('.floater-root');
          close(host ? host.id : null);
          return;
        }
        if (ev.target.classList && ev.target.classList.contains('floater__scrim')) {
          close(ev.target.closest('.floater-root').id);
        }
      });

      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && openId) { ev.preventDefault(); close(openId); return; }
        if (ev.key !== 'Tab' || !openId) return;
        var el = root(openId);
        var items = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      });

      // tab groups inside floaters
      document.addEventListener('click', function (ev) {
        var tab = ev.target.closest('.tab');
        if (!tab) return;
        var group = tab.closest('.floater__tabs');
        var body = group.parentElement.querySelector('.floater__body');
        group.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
        var target = tab.getAttribute('data-tab');
        body.querySelectorAll('[data-panel]').forEach(function (p) {
          p.hidden = p.getAttribute('data-panel') !== target;
        });
        body.scrollTop = 0;
        TQ.sfx.play('hover');
      });
    }

    return { open: open, close: close, init: init, current: function () { return openId; } };
  }());

  /* --------------------------------------------------- shared bootstrap */
  TQ.boot = function () {
    TQ.floater.init();
    // first gesture unlocks WebAudio (browsers block autoplay before input)
    ['pointerdown', 'keydown'].forEach(function (ev) {
      global.addEventListener(ev, function once() {
        TQ.sfx.unlock();
        global.removeEventListener(ev, once);
      }, { once: true });
    });
  };

}(window));
