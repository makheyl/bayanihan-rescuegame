/* =========================================================================
   TERRAQUA CLASH — landing.js
   Wires every landing-page button. Two navigate to real pages, the rest open
   floaters; nothing is a dead end.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ;
  var U = TQ.util;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SEAT_COLORS = ['#FF6B5B', '#4CC8DA', '#95DA51', '#FFD886'];
  var SEAT_CONTROLS = [
    'W A S D · Space',
    '↑ ← ↓ → · Enter',
    'I J K L · U',
    'Numpad 8 4 5 6 · Numpad 0'
  ];

  /* ---------------------------------------------------- segmented control */
  function bindSeg(rootId, read, write, opts) {
    var root = document.getElementById(rootId);
    if (!root) return function () {};
    opts = opts || {};
    function sync() {
      var cur = String(read());
      $$('button', root).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === cur));
      });
    }
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-v]');
      if (!b) return;
      write(b.getAttribute('data-v'));
      sync();
      if (opts.onChange) opts.onChange();
      TQ.sfx.play('select');
    });
    sync();
    return sync;
  }

  /* ------------------------------------------------------- lobby / seats */
  function seatCount() {
    var m = TQ.match.all();
    return U.clamp(m.humans + m.bots, 1, 4);
  }

  function ensurePicks() {
    var m = TQ.match.all();
    var picks = (m.picks || []).slice();
    var ids = TQ.animals.ids;
    for (var i = 0; i < 4; i++) {
      // byId() falls back to the first animal, so compare ids to spot a bad pick
      if (!picks[i] || TQ.animals.byId(picks[i]).id !== picks[i]) {
        // fill with the first animal no earlier seat has taken
        var free = ids.filter(function (id) { return picks.indexOf(id) === -1; });
        picks[i] = free.length ? free[0] : ids[i % ids.length];
      }
    }
    TQ.match.set('picks', picks);
    return picks;
  }

  function renderLobby() {
    var tbody = $('#lobbyTable tbody');
    if (!tbody) return;
    var m = TQ.match.all();
    var picks = ensurePicks();
    var seats = seatCount();
    var rows = '';
    for (var i = 0; i < seats; i++) {
      var isBot = i >= m.humans;
      var def = TQ.animals.byId(picks[i]);
      rows += '<tr>' +
        '<td><span class="player-dot" style="background:' + SEAT_COLORS[i] + '"></span>' +
          (isBot ? 'AI ' + (i - m.humans + 1) : 'Player ' + (i + 1)) + '</td>' +
        '<td>' + (isBot ? '<em>Computer</em>' : U.esc(SEAT_CONTROLS[i])) + '</td>' +
        '<td>' + U.esc(def.name) + ' <span style="opacity:.6">· ' + U.esc(TQ.animals.classLabel(def.cls)) + '</span></td>' +
        '</tr>';
    }
    tbody.innerHTML = rows;
  }

  /* ------------------------------------------------- guide dynamic lists */
  function renderGuideLists() {
    var pl = $('#guidePowerList');
    if (pl) {
      pl.innerHTML = TQ.powerups.TYPES.map(function (t) {
        return '<li><strong>' + U.esc(t.name) + '</strong> — ' + U.esc(t.desc) + '</li>';
      }).join('');
    }

    var sl = $('#guideSpeciesList');
    if (sl) {
      sl.innerHTML = TQ.animals.list.map(function (d) {
        var cls = d.cls === 'LAND' ? 'chip--land' : (d.cls === 'WATER' ? 'chip--water' : 'chip--amphi');
        return '<div class="note">' +
          '<div style="display:flex;align-items:center;gap:.5em;flex-wrap:wrap;margin-bottom:.35em">' +
            '<strong style="font-family:var(--font-display);font-size:1.05rem">' + U.esc(d.name) + '</strong>' +
            '<span style="opacity:.7">' + U.esc(d.species) + '</span>' +
            '<span class="chip ' + cls + '">' + U.esc(TQ.animals.classLabel(d.cls)) + '</span>' +
            d.sdg.map(function (n) { return '<span class="chip chip--sdg' + n + '">SDG ' + n + '</span>'; }).join('') +
          '</div>' +
          U.esc(d.fact) +
        '</div>';
      }).join('');
    }
  }

  /* ---------------------------------------------------------- settings */
  function bindSettings() {
    var S = TQ.settings;

    var vol = $('#setVolume'), volVal = $('#setVolumeVal');
    if (vol) {
      vol.value = Math.round(S.get('volume') * 100);
      volVal.textContent = vol.value + '%';
      vol.addEventListener('input', function () {
        S.set('volume', vol.value / 100);
        volVal.textContent = vol.value + '%';
        TQ.sfx.applyVolume();
      });
      vol.addEventListener('change', function () { TQ.sfx.play('hover'); });
    }

    var syncers = [];
    syncers.push(bindSeg('setMuted',
      function () { return S.get('muted') ? 1 : 0; },
      function (v) { S.set('muted', v === '1'); TQ.sfx.applyVolume(); }));
    syncers.push(bindSeg('setRound',
      function () { return S.get('roundLength'); },
      function (v) { S.set('roundLength', parseInt(v, 10)); }));
    syncers.push(bindSeg('setTide',
      function () { return S.get('tideSpeed'); },
      function (v) { S.set('tideSpeed', parseFloat(v)); }));
    syncers.push(bindSeg('setParticles',
      function () { return S.get('particles') ? 1 : 0; },
      function (v) { S.set('particles', v === '1'); }));
    syncers.push(bindSeg('setShake',
      function () { return S.get('screenShake') ? 1 : 0; },
      function (v) { S.set('screenShake', v === '1'); }));
    syncers.push(bindSeg('setNames',
      function () { return S.get('showNames') ? 1 : 0; },
      function (v) { S.set('showNames', v === '1'); }));

    var reset = $('#setReset');
    if (reset) {
      reset.addEventListener('click', function () {
        S.reset();
        if (vol) { vol.value = Math.round(S.get('volume') * 100); volVal.textContent = vol.value + '%'; }
        syncers.forEach(function (fn) { fn(); });
        TQ.sfx.applyVolume();
        TQ.toast('Settings restored to defaults');
      });
    }
  }

  /* ------------------------------------------------ menu keyboard nav */
  function bindMenuKeys() {
    var menu = $('#menu');
    if (!menu) return;
    menu.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      var items = $$('.menu-btn', menu);
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      ev.preventDefault();
      var next = (i + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    });
    $$('.menu-btn', menu).forEach(function (b) {
      b.addEventListener('mouseenter', function () { TQ.sfx.play('hover'); });
    });
  }

  /* ------------------------------------------------------------- boot */
  document.addEventListener('DOMContentLoaded', function () {
    TQ.boot();
    ensurePicks();

    $('#btnPlay').addEventListener('click', function () { TQ.nav.go('terrain-select.html'); });
    $('#btnCharacter').addEventListener('click', function () { TQ.nav.go('character-select.html'); });

    var botSync = bindSeg('segBots',
      function () { return TQ.match.get('bots'); },
      function (v) {
        var b = parseInt(v, 10);
        if (TQ.match.get('humans') + b > 4) b = 4 - TQ.match.get('humans');
        TQ.match.set('bots', b);
      },
      { onChange: renderLobby });

    bindSeg('segHumans',
      function () { return TQ.match.get('humans'); },
      function (v) {
        var h = parseInt(v, 10);
        TQ.match.set('humans', h);
        if (h + TQ.match.get('bots') > 4) TQ.match.set('bots', 4 - h);
        botSync();
      },
      { onChange: renderLobby });

    renderLobby();
    renderGuideLists();
    bindSettings();
    bindMenuKeys();

    $('#mpStart').addEventListener('click', function () { TQ.nav.go('terrain-select.html'); });
    $('#mpToCharacters').addEventListener('click', function () { TQ.nav.go('character-select.html'); });
    $('#guidePlay').addEventListener('click', function () { TQ.nav.go('terrain-select.html'); });

    $('#quitConfirm').addEventListener('click', function () {
      TQ.sfx.play('back');
      var note = $('#quitNote');
      global.close();
      // window.close() only works for script-opened windows, so say so plainly
      setTimeout(function () {
        if (note) {
          note.textContent = 'Your browser will not let a page close a tab it did not open — ' +
            'close this tab manually to exit.';
        }
      }, 220);
    });

    // deep-link support: index.html#guide opens the guide straight away
    if (global.location.hash === '#guide') TQ.floater.open('fl-guide');
    if (global.location.hash === '#settings') TQ.floater.open('fl-settings');
  });

}(window));
