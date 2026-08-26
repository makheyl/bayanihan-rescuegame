/* =========================================================================
   TERRAQUA CLASH — character-select.js
   One roster grid, one seat strip. Clicking a seat makes it active; clicking
   an animal assigns it to the active seat and advances. Duplicates are
   allowed but discouraged (the taken animal dims and shows which seats hold
   it), so a four-player lobby can still mirror-match on purpose.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ;
  var U = TQ.util;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var SEAT_COLORS = ['#FF6B5B', '#4CC8DA', '#95DA51', '#FFD886'];
  var SEAT_KEYS = ['WASD + Space', 'Arrows + Enter', 'IJKL + U', 'Numpad + 0'];

  var active = 0;
  var picks, seats;

  function refreshState() {
    var m = TQ.match.all();
    seats = U.clamp(m.humans + m.bots, 1, 4);
    picks = (m.picks || []).slice(0, 4);
    var ids = TQ.animals.ids;
    for (var i = 0; i < 4; i++) {
      if (!picks[i] || TQ.animals.byId(picks[i]).id !== picks[i]) {
        var free = ids.filter(function (id) { return picks.indexOf(id) === -1; });
        picks[i] = free.length ? free[0] : ids[i % ids.length];
      }
    }
    if (active >= seats) active = seats - 1;
  }

  function isBot(i) { return i >= TQ.match.get('humans'); }

  /* ------------------------------------------------------------- seats */
  function renderSeats() {
    var host = $('#seats');
    host.innerHTML = '';
    for (var i = 0; i < seats; i++) {
      (function (idx) {
        var def = TQ.animals.byId(picks[idx]);
        var btn = document.createElement('button');
        btn.className = 'seat';
        btn.type = 'button';
        btn.setAttribute('aria-current', String(idx === active));
        btn.setAttribute('data-bot', String(isBot(idx)));
        btn.setAttribute('aria-label', 'Seat ' + (idx + 1) + ', currently ' + def.name + '. Click to edit.');

        var cv = document.createElement('canvas');
        cv.className = 'seat__avatar';

        var meta = document.createElement('div');
        meta.className = 'seat__meta';
        meta.innerHTML =
          '<div class="seat__who">' + (isBot(idx) ? 'AI ' + (idx - TQ.match.get('humans') + 1) : 'Player ' + (idx + 1)) + '</div>' +
          '<div class="seat__pick">' + U.esc(def.name) + ' · ' + U.esc(TQ.animals.classLabel(def.cls)) + '</div>' +
          (isBot(idx) ? '' : '<div class="seat__pick" style="opacity:.6;font-size:.68rem">' + U.esc(SEAT_KEYS[idx]) + '</div>');

        var dot = document.createElement('span');
        dot.className = 'seat__dot';
        dot.style.background = SEAT_COLORS[idx];

        btn.appendChild(dot);
        btn.appendChild(cv);
        btn.appendChild(meta);
        btn.addEventListener('click', function () {
          active = idx;
          TQ.sfx.play('select');
          renderSeats();
          renderRoster();
        });
        host.appendChild(btn);

        // canvas needs layout before it can size itself
        requestAnimationFrame(function () {
          TQ.animals.drawToCanvas(cv, def, { ground: false, t: idx * 0.7 });
        });
      }(i));
    }

    var hint = $('#rosterHint');
    hint.textContent = isBot(active)
      ? 'Picking for AI ' + (active - TQ.match.get('humans') + 1) + '. Bots play their animal\'s strengths.'
      : 'Picking for Player ' + (active + 1) + ' (' + SEAT_KEYS[active] + ').';
  }

  /* ------------------------------------------------------------ roster */
  function statRow(label, value, cls) {
    return '<div class="stat ' + cls + '">' +
      '<span class="stat__label">' + label + '</span>' +
      '<span class="stat__track"><span class="stat__fill" style="width:' + (value / 5 * 100) + '%"></span></span>' +
    '</div>';
  }

  function renderRoster() {
    var host = $('#roster');
    host.innerHTML = '';

    TQ.animals.list.forEach(function (def, n) {
      var heldBy = [];
      for (var i = 0; i < seats; i++) if (picks[i] === def.id) heldBy.push(i);

      var card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.setAttribute('aria-pressed', String(picks[active] === def.id));
      if (heldBy.length && picks[active] !== def.id) card.setAttribute('data-taken', 'true');
      card.setAttribute('aria-label', def.name + ', ' + def.species + ', ' + TQ.animals.classLabel(def.cls) + ' class');

      var clsChip = def.cls === 'LAND' ? 'chip--land' : (def.cls === 'WATER' ? 'chip--water' : 'chip--amphi');

      card.innerHTML =
        '<div class="card__art">' +
          '<canvas></canvas>' +
          (heldBy.length ? '<div class="seat-badge">' + heldBy.map(function (s) {
            return '<span style="background:' + SEAT_COLORS[s] + '">' + (s + 1) + '</span>';
          }).join('') + '</div>' : '') +
          '<div class="card__src">' + U.esc(def.source) + '</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<div>' +
            '<div class="card__name">' + U.esc(def.name) + '</div>' +
            '<div class="card__species">' + U.esc(def.species) + '</div>' +
          '</div>' +
          '<div class="chip-row">' +
            '<span class="chip ' + clsChip + '">' + U.esc(TQ.animals.classLabel(def.cls)) + '</span>' +
            def.sdg.map(function (s) { return '<span class="chip chip--sdg' + s + '">SDG ' + s + '</span>'; }).join('') +
          '</div>' +
          '<div class="card__blurb">' + U.esc(def.blurb) + '</div>' +
          '<div class="stats">' +
            statRow('Speed', def.stats.speed, '') +
            statRow('Push', def.stats.push, 'stat--push') +
            statRow('Size', def.stats.size, 'stat--size') +
            statRow('Grip', def.stats.grip, 'stat--grip') +
          '</div>' +
        '</div>';

      card.addEventListener('click', function () { assign(def.id); });
      card.addEventListener('mouseenter', function () { TQ.sfx.play('hover'); });
      host.appendChild(card);

      var cv = card.querySelector('canvas');
      cv.style.animationDelay = (n * 0.22) + 's';
      requestAnimationFrame(function () {
        TQ.animals.drawToCanvas(cv, def, { t: n * 0.9 });
      });
    });
  }

  function assign(animalId) {
    picks[active] = animalId;
    TQ.match.set('picks', picks);
    TQ.sfx.play('select');
    // advance to the next seat so a 4-player lobby fills in one pass
    active = (active + 1) % seats;
    renderSeats();
    renderRoster();
  }

  function randomise() {
    var ids = TQ.animals.ids.slice();
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    for (var s = 0; s < 4; s++) picks[s] = ids[s % ids.length];
    TQ.match.set('picks', picks);
    TQ.sfx.play('pickup');
    renderSeats();
    renderRoster();
    TQ.toast('Roster shuffled');
  }

  /* --------------------------------------------------------- keyboard */
  function bindKeys() {
    document.addEventListener('keydown', function (ev) {
      if (TQ.floater.current()) return;
      var cards = $$('#roster .card');
      var i = cards.indexOf(document.activeElement);

      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        if (i === -1) { cards[0].focus(); return; }
        var d = ev.key === 'ArrowRight' ? 1 : -1;
        cards[(i + d + cards.length) % cards.length].focus();
        TQ.sfx.play('hover');
      } else if (ev.key === 'Escape') {
        TQ.nav.back('index.html');
      }
    });
  }

  /* ------------------------------------------------------------- boot */
  document.addEventListener('DOMContentLoaded', function () {
    TQ.boot();
    refreshState();
    renderSeats();
    renderRoster();
    bindKeys();

    $('#btnBack').addEventListener('click', function () { TQ.nav.back('index.html'); });
    $('#btnRandom').addEventListener('click', randomise);
    $('#btnConfirm').addEventListener('click', function () { TQ.nav.go('terrain-select.html'); });

    // canvases size from CSS, so redraw them after a resize
    var resizeTimer = 0;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { renderSeats(); renderRoster(); }, 180);
    });
  });

}(window));
